-- OpSync Database Initialization Script
-- This script sets up the initial database structure and security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application user with limited privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opsync_app') THEN
    CREATE ROLE opsync_app WITH LOGIN PASSWORD 'app_user_password_change_in_production';
  END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE opsync TO opsync_app;
GRANT USAGE ON SCHEMA public TO opsync_app;
GRANT CREATE ON SCHEMA public TO opsync_app;

-- Create logs directory structure
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security function to mask sensitive data
CREATE OR REPLACE FUNCTION mask_sensitive_provider(provider_name TEXT, sensitivity_level TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE sensitivity_level
    WHEN 'HIGH' THEN
      RETURN CASE 
        WHEN LOWER(provider_name) LIKE '%mossad%' OR LOWER(provider_name) LIKE '%shin%' THEN 'Security-Vendor-' || SUBSTR(MD5(provider_name), 1, 1)
        WHEN LOWER(provider_name) LIKE '%bank%' OR LOWER(provider_name) LIKE '%finance%' THEN 'Finance-Vendor-' || SUBSTR(MD5(provider_name), 1, 1)
        WHEN LOWER(provider_name) LIKE '%health%' OR LOWER(provider_name) LIKE '%medical%' THEN 'Health-Vendor-' || SUBSTR(MD5(provider_name), 1, 1)
        ELSE 'Sensitive-Vendor-' || SUBSTR(MD5(provider_name), 1, 1)
      END;
    WHEN 'MEDIUM' THEN
      RETURN CASE 
        WHEN LOWER(provider_name) LIKE '%aws%' OR LOWER(provider_name) LIKE '%amazon%' THEN 'Cloud-Provider-A'
        WHEN LOWER(provider_name) LIKE '%gcp%' OR LOWER(provider_name) LIKE '%google%' THEN 'Cloud-Provider-G'
        WHEN LOWER(provider_name) LIKE '%azure%' OR LOWER(provider_name) LIKE '%microsoft%' THEN 'Cloud-Provider-M'
        ELSE provider_name
      END;
    ELSE
      RETURN provider_name;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine sensitivity level based on provider
CREATE OR REPLACE FUNCTION get_provider_sensitivity(provider_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- HIGH sensitivity keywords
  IF LOWER(provider_name) ~ '.*(mossad|shin|bet|security|defense|military|government|health|medical|bank|finance|crypto).*' THEN
    RETURN 'HIGH';
  END IF;
  
  -- MEDIUM sensitivity keywords  
  IF LOWER(provider_name) ~ '.*(aws|amazon|gcp|google|azure|microsoft|hosting|server|cloud).*' THEN
    RETURN 'MEDIUM';
  END IF;
  
  -- Default to LOW
  RETURN 'LOW';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically set retention policies
CREATE OR REPLACE FUNCTION set_expense_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Set retention based on amount and sensitivity
  IF NEW.amount >= 20000 OR NEW.sensitivity_level = 'HIGH' THEN
    NEW.retention_until = NULL; -- Permanent retention
  ELSIF NEW.amount >= 5000 THEN
    NEW.retention_until = NEW.created_at + INTERVAL '1 year';
  ELSE
    NEW.retention_until = NEW.created_at + INTERVAL '90 days';
  END IF;
  
  -- Auto-mask sensitive providers
  IF NEW.sensitivity_level IN ('MEDIUM', 'HIGH') THEN
    NEW.provider_masked_name = mask_sensitive_provider(NEW.provider_name, NEW.sensitivity_level);
  ELSE
    NEW.provider_masked_name = NEW.provider_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit trail trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    details,
    timestamp
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    ),
    CURRENT_TIMESTAMP
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;