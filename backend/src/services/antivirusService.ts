import { logger } from '@/config/logger';

export interface ScanResult {
  isClean: boolean;
  threats: string[];
  scanTime: number;
}

export class AntivirusService {
  
  /**
   * Scans a file buffer for potential threats
   * This is a basic implementation that checks for:
   * - Suspicious file signatures
   * - Macro detection in documents
   * - Embedded scripts/executables
   */
  static async scanFile(buffer: Buffer, filename: string, mimeType: string): Promise<ScanResult> {
    const startTime = Date.now();
    const threats: string[] = [];
    
    try {
      logger.info(`Starting antivirus scan for file: ${filename}`);
      
      // Check file signatures
      const signatureThreats = this.checkFileSignatures(buffer);
      threats.push(...signatureThreats);
      
      // Check for embedded macros
      if (this.isPotentialMacroDocument(mimeType, buffer)) {
        const macroThreats = this.checkForMacros(buffer);
        threats.push(...macroThreats);
      }
      
      // Check for suspicious patterns
      const patternThreats = this.checkSuspiciousPatterns(buffer);
      threats.push(...patternThreats);
      
      // Check file size anomalies
      const sizeThreats = this.checkFileSizeAnomalies(buffer, mimeType);
      threats.push(...sizeThreats);
      
      const scanTime = Date.now() - startTime;
      const isClean = threats.length === 0;
      
      logger.info(`Antivirus scan completed for ${filename}: ${isClean ? 'CLEAN' : 'THREATS DETECTED'} (${scanTime}ms)`);
      if (!isClean) {
        logger.warn(`Threats detected in ${filename}:`, threats);
      }
      
      return {
        isClean,
        threats,
        scanTime
      };
      
    } catch (error) {
      logger.error('Antivirus scan failed:', error);
      return {
        isClean: false,
        threats: ['SCAN_ERROR: Unable to complete security scan'],
        scanTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Check for known malicious file signatures
   */
  private static checkFileSignatures(buffer: Buffer): string[] {
    const threats: string[] = [];
    const header = buffer.subarray(0, 16).toString('hex');
    
    // Known malicious signatures (examples)
    const maliciousSignatures = [
      '4d5a9000',  // PE executable header
      '7f454c46',  // ELF header
      'cafebabe',  // Java class file
      '504b0304',  // ZIP with suspicious structure
    ];
    
    // Check for executable headers in documents
    if (header.includes('4d5a') || header.includes('7f454c46')) {
      threats.push('EXECUTABLE_EMBEDDED: Document contains executable code');
    }
    
    return threats;
  }
  
  /**
   * Check if file type supports macros
   */
  private static isPotentialMacroDocument(mimeType: string, buffer: Buffer): boolean {
    return mimeType === 'application/pdf' || 
           buffer.includes(Buffer.from('macro', 'utf8')) ||
           buffer.includes(Buffer.from('script', 'utf8'));
  }
  
  /**
   * Check for embedded macros
   */
  private static checkForMacros(buffer: Buffer): string[] {
    const threats: string[] = [];
    const content = buffer.toString('utf8').toLowerCase();
    
    const macroPatterns = [
      /\/javascript/gi,
      /\/js[^a-z]/gi,
      /activexobject/gi,
      /shell\.application/gi,
      /wscript\.shell/gi,
      /eval\s*\(/gi,
      /document\.write/gi,
      /fromcharcode/gi,
      /vbscript/gi,
      /macro[a-z]*\s*=/gi
    ];
    
    for (const pattern of macroPatterns) {
      if (pattern.test(content)) {
        threats.push(`MACRO_DETECTED: Suspicious macro or script detected (${pattern.source})`);
      }
    }
    
    return threats;
  }
  
  /**
   * Check for suspicious patterns that might indicate malware
   */
  private static checkSuspiciousPatterns(buffer: Buffer): string[] {
    const threats: string[] = [];
    const content = buffer.toString('utf8').toLowerCase();
    
    const suspiciousPatterns = [
      /powershell/gi,
      /cmd\.exe/gi,
      /rundll32/gi,
      /regsvr32/gi,
      /certutil/gi,
      /bitsadmin/gi,
      /mshta/gi,
      /cscript/gi,
      /wscript/gi,
      /net\.webclient/gi,
      /system\.diagnostics\.process/gi,
      /base64/gi,
      /frombase64string/gi
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        threats.push(`SUSPICIOUS_PATTERN: Potentially malicious pattern detected (${pattern.source})`);
      }
    }
    
    // Check for multiple suspicious patterns (higher risk)
    const matches = suspiciousPatterns.filter(pattern => pattern.test(content));
    if (matches.length >= 3) {
      threats.push('HIGH_RISK: Multiple suspicious patterns detected');
    }
    
    return threats;
  }
  
  /**
   * Check for file size anomalies
   */
  private static checkFileSizeAnomalies(buffer: Buffer, mimeType: string): string[] {
    const threats: string[] = [];
    const size = buffer.length;
    
    // Unusually large files for their type
    if (mimeType === 'image/png' && size > 50 * 1024 * 1024) { // 50MB PNG is suspicious
      threats.push('SIZE_ANOMALY: Image file unusually large for type');
    }
    
    if (mimeType === 'image/jpeg' && size > 100 * 1024 * 1024) { // 100MB JPEG is suspicious
      threats.push('SIZE_ANOMALY: Image file unusually large for type');
    }
    
    // Check for hidden data (steganography indicators)
    if (mimeType.startsWith('image/') && size > 10 * 1024 * 1024) {
      const entropy = this.calculateEntropy(buffer);
      if (entropy > 7.5) { // High entropy might indicate hidden data
        threats.push('STEGANOGRAPHY_RISK: Image has high entropy, may contain hidden data');
      }
    }
    
    return threats;
  }
  
  /**
   * Calculate Shannon entropy of file data
   */
  private static calculateEntropy(buffer: Buffer): number {
    const frequencies = new Array(256).fill(0);
    
    for (let i = 0; i < buffer.length; i++) {
      frequencies[buffer[i]]++;
    }
    
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const p = frequencies[i] / buffer.length;
        entropy -= p * Math.log2(p);
      }
    }
    
    return entropy;
  }
  
  /**
   * Get security recommendation based on scan results
   */
  static getSecurityRecommendation(scanResult: ScanResult): string {
    if (scanResult.isClean) {
      return 'File passed security scan - safe to process';
    }
    
    const threatCount = scanResult.threats.length;
    if (threatCount === 1 && scanResult.threats[0].includes('SUSPICIOUS_PATTERN')) {
      return 'File contains potentially suspicious content - review before processing';
    }
    
    if (threatCount >= 3 || scanResult.threats.some(t => t.includes('HIGH_RISK'))) {
      return 'File contains multiple security threats - DO NOT PROCESS';
    }
    
    return 'File contains security concerns - proceed with caution';
  }
}