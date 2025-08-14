import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginRequest } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface LoginFormData {
  username: string;
  password: string;
  website: string; // Honeypot field
}

const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [generalError, setGeneralError] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    // Clear previous errors
    setGeneralError('');
    
    // Check honeypot field
    if (data.website && data.website.trim() !== '') {
      // Bot detected - simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      setError('username', { message: 'Please try again' });
      setGeneralError('Please try again');
      return;
    }

    const credentials: LoginRequest = {
      username: data.username,
      password: data.password
    };

    console.log('About to call login with:', credentials);
    const success = await login(credentials);
    console.log('Login returned success:', success);
    
    if (!success) {
      console.log('Login failed - setting error states');
      setLoginAttempts(prev => prev + 1);
      setGeneralError('Invalid username or password. Please try again.');
    } else {
      console.log('Login succeeded');
      // Clear any previous errors
      setGeneralError('');
    }
  };

  const isAccountLocked = loginAttempts >= 5;

  return (
   <div className="min-h-screen flex items-start justify-center bg-gradient-primary px-4 sm:px-6 lg:px-8 pt-36">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 rounded-card bg-white shadow-soft">
              <img src="/logo.png" alt="OpSync Logo" className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary-text mb-2">
            OpSync
          </h1>
        </div>

        {/* Login Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* General Error Display */}
            {generalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600 font-medium">
                    {generalError}
                  </p>
                </div>
              </div>
            )}
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-primary-text mb-2">
                Username
              </label>
              <input
                {...register('username', {
                  required: 'Username is required',
                  pattern: {
                    value: /^ops-user-\d+$/,
                    message: 'Invalid username format'
                  }
                })}
                type="text"
                id="username"
                autoComplete="username"
                className="input"
                disabled={isAccountLocked}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-security-high">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-primary-text mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  className="input pr-10"
                  disabled={isAccountLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-secondary hover:text-primary-text"
                  disabled={isAccountLocked}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-security-high">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Honeypot Field (hidden) */}
            <input
              {...register('website')}
              type="text"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              className="absolute left-[-9999px] opacity-0"
              aria-hidden="true"
            />

            {/* Rate Limiting Warning */}
            {loginAttempts >= 3 && (
              <div className="p-3 rounded-lg bg-security-high bg-opacity-10 border border-security-high border-opacity-20">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-security-high" />
                  <p className="text-sm text-security-high">
                    {isAccountLocked 
                      ? 'Account temporarily locked. Please wait 15 minutes.'
                      : `${5 - loginAttempts} attempts remaining before lockout.`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isAccountLocked}
              className="w-full btn btn-primary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <LoadingSpinner size="small" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;