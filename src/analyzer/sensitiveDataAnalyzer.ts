import * as fs from 'fs';
import * as path from 'path';

export interface SecurityIssue {
  type: 'secret' | 'pii' | 'security-practice';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file: string;
  line: number;
  column: number;
  code: string;
  recommendation: string;
}

export interface SecurityAnalysisResult {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  issuesByType: {
    secrets: SecurityIssue[];
    pii: SecurityIssue[];
    securityPractices: SecurityIssue[];
  };
  filesScanned: number;
  timestamp: string;
}

export class SensitiveDataAnalyzer {
  private projectRoot: string;
  private issues: SecurityIssue[] = [];
  private filesScanned = 0;

  // Patterns for detecting secrets and API keys
  private secretPatterns = [
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      severity: 'critical' as const,
      recommendation: 'Use AWS IAM roles or environment variables. Never commit AWS credentials.',
    },
    {
      name: 'AWS Secret Key',
      pattern: /aws_secret_access_key\s*=\s*['"]([A-Za-z0-9/+=]{40})['"]/gi,
      severity: 'critical' as const,
      recommendation: 'Use AWS IAM roles or environment variables. Never commit AWS credentials.',
    },
    {
      name: 'Firebase API Key',
      pattern: /AIza[0-9A-Za-z_-]{35}/g,
      severity: 'high' as const,
      recommendation: 'Use Firebase security rules and restrict API key usage. Consider environment variables.',
    },
    {
      name: 'Google Cloud API Key',
      pattern: /AIza[0-9A-Za-z\\-_]{35}/g,
      severity: 'high' as const,
      recommendation: 'Use GCP service accounts or environment variables. Restrict API key permissions.',
    },
    {
      name: 'GitHub Token',
      pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
      severity: 'critical' as const,
      recommendation: 'Use GitHub secrets or environment variables. Revoke this token immediately.',
    },
    {
      name: 'Generic API Key',
      pattern: /['"]?api[_-]?key['"]?\s*[:=]\s*['"]([A-Za-z0-9_\-]{20,})['"]/gi,
      severity: 'high' as const,
      recommendation: 'Store API keys in environment variables or secure configuration.',
    },
    {
      name: 'Generic Secret',
      pattern: /['"]?secret['"]?\s*[:=]\s*['"]([A-Za-z0-9_\-!@#$%^&*()+=]{20,})['"]/gi,
      severity: 'high' as const,
      recommendation: 'Store secrets in environment variables or secure vaults.',
    },
    {
      name: 'Private Key',
      pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
      severity: 'critical' as const,
      recommendation: 'Never commit private keys. Use secure key management systems.',
    },
    {
      name: 'JWT Token',
      pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      severity: 'high' as const,
      recommendation: 'Never hardcode JWT tokens. Use secure session management.',
    },
    {
      name: 'Slack Token',
      pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
      severity: 'critical' as const,
      recommendation: 'Use environment variables for Slack tokens. Revoke this token immediately.',
    },
    {
      name: 'Stripe API Key',
      pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      severity: 'critical' as const,
      recommendation: 'Use environment variables for Stripe keys. Revoke and rotate this key.',
    },
    {
      name: 'Twilio API Key',
      pattern: /SK[a-f0-9]{32}/g,
      severity: 'critical' as const,
      recommendation: 'Use environment variables for Twilio credentials.',
    },
    {
      name: 'Generic Password',
      pattern: /['"]?password['"]?\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
      severity: 'high' as const,
      recommendation: 'Never hardcode passwords. Use environment variables or secure vaults.',
    },
    {
      name: 'Database Connection String',
      pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^/]+/gi,
      severity: 'critical' as const,
      recommendation: 'Use environment variables for database credentials.',
    },
  ];

  // Patterns for detecting PII
  private piiPatterns = [
    {
      name: 'Email Address',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      severity: 'medium' as const,
      recommendation: 'Ensure email addresses are not hardcoded. Use proper data handling practices.',
    },
    {
      name: 'Phone Number (US)',
      pattern: /\b(?:\+1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
      severity: 'medium' as const,
      recommendation: 'Ensure phone numbers are not hardcoded. Use proper data sanitization.',
    },
    {
      name: 'Social Security Number',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      severity: 'critical' as const,
      recommendation: 'Never store SSN in code. Use encryption and secure storage.',
    },
    {
      name: 'Credit Card Number',
      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
      severity: 'critical' as const,
      recommendation: 'Never store credit card numbers in code. Use PCI-compliant payment processors.',
    },
    {
      name: 'IP Address',
      pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      severity: 'low' as const,
      recommendation: 'Ensure IP addresses are not exposing internal infrastructure.',
    },
  ];

  // Security best practice patterns
  private securityPracticePatterns = [
    {
      name: 'Console.log in Production',
      pattern: /console\.(log|debug|info|warn|error)\(/g,
      severity: 'low' as const,
      recommendation: 'Remove console statements or use proper logging library for production.',
    },
    {
      name: 'eval() Usage',
      pattern: /\beval\s*\(/g,
      severity: 'critical' as const,
      recommendation: 'Avoid using eval() as it can lead to code injection vulnerabilities.',
    },
    {
      name: 'Disabled SSL/TLS Verification',
      pattern: /(?:rejectUnauthorized|checkServerIdentity|strictSSL)\s*[:=]\s*false/gi,
      severity: 'critical' as const,
      recommendation: 'Never disable SSL/TLS verification in production. Use proper certificates.',
    },
    {
      name: 'Insecure HTTP URL',
      pattern: /['"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^'"]+['"]/g,
      severity: 'medium' as const,
      recommendation: 'Use HTTPS for all external communications to ensure data encryption.',
    },
    {
      name: 'SQL Injection Risk',
      pattern: /(?:execute|query|raw)\s*\([^)]*\+[^)]*\)/g,
      severity: 'high' as const,
      recommendation: 'Use parameterized queries to prevent SQL injection attacks.',
    },
    {
      name: 'Weak Crypto Algorithm',
      pattern: /\b(?:createHash\(['"](?:md5|sha1)['"]\)|\.md5\(|\.sha1\(|crypto\.MD5|crypto\.SHA1|CryptoJS\.MD5|CryptoJS\.SHA1|hashlib\.md5|hashlib\.sha1)\b/gi,
      severity: 'high' as const,
      recommendation: 'Use strong cryptographic algorithms like AES-256, SHA-256, or bcrypt.',
    },
    {
      name: 'Hardcoded localhost',
      pattern: /['"](?:http|https):\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?['"]/g,
      severity: 'low' as const,
      recommendation: 'Use environment variables for API endpoints to support different environments.',
    },
    {
      name: 'Unsafe innerHTML',
      pattern: /dangerouslySetInnerHTML/g,
      severity: 'high' as const,
      recommendation: 'Sanitize HTML content to prevent XSS attacks. Use libraries like DOMPurify.',
    },
    {
      name: 'Missing Input Validation',
      pattern: /(?:input|textarea|select)\.value\s*(?!==|!==|&&|\|\|)/g,
      severity: 'medium' as const,
      recommendation: 'Always validate and sanitize user input before processing.',
    },
    {
      name: 'Inline Styles',
      pattern: /style=\{\{[^}]+\}\}/g,
      severity: 'low' as const,
      recommendation: 'Use StyleSheet.create() instead of inline styles for better performance and maintainability.',
    },
  ];

  // Files and patterns to exclude from scanning
  private excludePatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /__tests__/,
    /\.json$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /\.env\.example$/,
    /\.md$/,
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public async analyze(): Promise<SecurityAnalysisResult> {
    console.log('🔒 Starting security analysis...');
    this.issues = [];
    this.filesScanned = 0;

    const srcDir = path.join(this.projectRoot, 'src');
    if (fs.existsSync(srcDir)) {
      await this.scanDirectory(srcDir);
    }

    // Also scan root level files
    const rootFiles = fs.readdirSync(this.projectRoot);
    for (const file of rootFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.statSync(fullPath).isFile() && this.shouldScanFile(fullPath)) {
        await this.scanFile(fullPath);
      }
    }

    const result = this.generateReport();
    console.log(`✅ Security scan complete. Found ${result.totalIssues} issues in ${this.filesScanned} files.`);

    return result;
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (this.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && this.shouldScanFile(fullPath)) {
        await this.scanFile(fullPath);
      }
    }
  }

  private shouldExclude(filePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  private shouldScanFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx', '.json', '.env'].includes(ext);
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      this.filesScanned++;

      // Scan for secrets
      this.secretPatterns.forEach(pattern => {
        this.findMatches(filePath, content, lines, pattern, 'secret');
      });

      // Scan for PII
      this.piiPatterns.forEach(pattern => {
        this.findMatches(filePath, content, lines, pattern, 'pii');
      });

      // Scan for security practice violations
      this.securityPracticePatterns.forEach(pattern => {
        this.findMatches(filePath, content, lines, pattern, 'security-practice');
      });

    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error);
    }
  }

  private findMatches(
    filePath: string,
    content: string,
    lines: string[],
    pattern: { name: string; pattern: RegExp; severity: 'critical' | 'high' | 'medium' | 'low'; recommendation: string },
    type: 'secret' | 'pii' | 'security-practice'
  ): void {
    const matches = content.matchAll(pattern.pattern);

    for (const match of matches) {
      if (!match.index) continue;

      // Find line and column number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const columnNumber = beforeMatch.length - beforeMatch.lastIndexOf('\n');

      // Get the code snippet
      const codeLine = lines[lineNumber - 1]?.trim() || '';

      // Skip if it's a comment or obvious test/example data
      if (this.isLikelyFalsePositive(codeLine, pattern.name)) {
        continue;
      }

      const issue: SecurityIssue = {
        type,
        severity: pattern.severity,
        category: pattern.name,
        message: `Found ${pattern.name}`,
        file: path.relative(this.projectRoot, filePath),
        line: lineNumber,
        column: columnNumber,
        code: codeLine.substring(0, 100), // Limit code snippet length
        recommendation: pattern.recommendation,
      };

      this.issues.push(issue);
    }
  }

  private isLikelyFalsePositive(codeLine: string, patternName: string): boolean {
    // Skip comments
    if (codeLine.trim().startsWith('//') || codeLine.trim().startsWith('/*') || codeLine.trim().startsWith('*')) {
      return true;
    }

    // Skip example/placeholder values
    const examplePatterns = [
      /example/i,
      /placeholder/i,
      /dummy/i,
      /test/i,
      /mock/i,
      /your[-_]api[-_]key/i,
      /insert[-_]key[-_]here/i,
      /xxx/i,
    ];

    if (examplePatterns.some(p => p.test(codeLine))) {
      return true;
    }

    // Skip email patterns in documentation or comments
    if (patternName === 'Email Address' && (codeLine.includes('@example.com') || codeLine.includes('example@'))) {
      return true;
    }

    // Skip localhost IPs
    if (patternName === 'IP Address' && (codeLine.includes('127.0.0.1') || codeLine.includes('0.0.0.0'))) {
      return true;
    }

    // Skip XML/SVG namespace URLs (not actual HTTP requests)
    if (patternName === 'Insecure HTTP URL' && (
      codeLine.includes('xmlns') ||
      codeLine.includes('www.w3.org') ||
      codeLine.includes('xmlschema') ||
      codeLine.includes('namespace')
    )) {
      return true;
    }

    return false;
  }

  private generateReport(): SecurityAnalysisResult {
    const issuesByType = {
      secrets: this.issues.filter(i => i.type === 'secret'),
      pii: this.issues.filter(i => i.type === 'pii'),
      securityPractices: this.issues.filter(i => i.type === 'security-practice'),
    };

    return {
      totalIssues: this.issues.length,
      criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
      highIssues: this.issues.filter(i => i.severity === 'high').length,
      mediumIssues: this.issues.filter(i => i.severity === 'medium').length,
      lowIssues: this.issues.filter(i => i.severity === 'low').length,
      issuesByType,
      filesScanned: this.filesScanned,
      timestamp: new Date().toISOString(),
    };
  }

  public saveReport(outputPath: string, result: SecurityAnalysisResult): void {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📄 Security report saved to ${outputPath}`);
  }
}
