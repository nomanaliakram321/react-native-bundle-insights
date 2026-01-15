import * as fs from 'fs';
import * as path from 'path';

export interface SideEffect {
  file: string;
  line: number;
  code: string;
  type: 'console' | 'global-mutation' | 'require-side-effect' | 'top-level-call';
  severity: 'error' | 'warning';
}

export interface TreeShakeIssue {
  file: string;
  issue: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
}

export interface TreeShakeScore {
  score: number; // 0-100
  usesESModules: boolean;
  hasNamedExports: boolean;
  hasDefaultExport: boolean;
  hasSideEffects: boolean;
  packageJsonConfigured: boolean;
}

export interface TreeShakeAnalysis {
  score: TreeShakeScore;
  issues: TreeShakeIssue[];
  sideEffects: SideEffect[];
  recommendations: string[];
  estimatedImprovement: number; // bytes
}

export class TreeShakeAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze project for tree-shaking issues
   */
  async analyze(): Promise<TreeShakeAnalysis> {
    const sourceFiles = this.getSourceFiles();

    let usesESModules = false;
    let hasNamedExports = false;
    let hasDefaultExport = false;
    const sideEffects: SideEffect[] = [];
    const issues: TreeShakeIssue[] = [];

    // Analyze each source file
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.projectRoot, file);

        // Check for ES modules
        if (this.usesESModules(content)) {
          usesESModules = true;
        }

        // Check for named exports
        if (this.hasNamedExports(content)) {
          hasNamedExports = true;
        }

        // Check for default exports
        if (this.hasDefaultExport(content)) {
          hasDefaultExport = true;
          issues.push({
            file: relativePath,
            issue: 'Uses default export',
            suggestion: 'Use named exports instead for better tree-shaking',
            severity: 'warning',
          });
        }

        // Detect side effects
        const fileSideEffects = this.detectSideEffects(content, relativePath);
        sideEffects.push(...fileSideEffects);

        // Check for CommonJS
        if (this.usesCommonJS(content)) {
          issues.push({
            file: relativePath,
            issue: 'Uses CommonJS (require/module.exports)',
            suggestion: 'Convert to ES6 modules (import/export)',
            severity: 'error',
          });
        }
      } catch (error) {
        // Ignore files we can't read
      }
    }

    // Check package.json configuration
    const packageJsonConfigured = this.checkPackageJson();
    if (!packageJsonConfigured) {
      issues.push({
        file: 'package.json',
        issue: 'Missing sideEffects field',
        suggestion: 'Add "sideEffects": false to package.json if your code has no side effects',
        severity: 'warning',
      });
    }

    const hasSideEffects = sideEffects.length > 0;
    const score = this.calculateScore(
      usesESModules,
      hasNamedExports,
      hasDefaultExport,
      hasSideEffects,
      packageJsonConfigured
    );

    const recommendations = this.generateRecommendations(score, issues, sideEffects);
    const estimatedImprovement = this.estimateImprovement(issues, sideEffects);

    return {
      score,
      issues,
      sideEffects,
      recommendations,
      estimatedImprovement,
    };
  }

  /**
   * Get all source files in src/
   */
  private getSourceFiles(): string[] {
    const srcDir = path.join(this.projectRoot, 'src');
    if (!fs.existsSync(srcDir)) {
      return [];
    }
    return this.getAllFiles(srcDir);
  }

  /**
   * Get all files recursively
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (
            entry.name !== 'node_modules' &&
            entry.name !== '.git' &&
            entry.name !== '__tests__'
          ) {
            files.push(...this.getAllFiles(fullPath));
          }
        } else if (entry.isFile()) {
          if (
            entry.name.endsWith('.ts') ||
            entry.name.endsWith('.tsx') ||
            entry.name.endsWith('.js') ||
            entry.name.endsWith('.jsx')
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return files;
  }

  /**
   * Check if file uses ES modules
   */
  private usesESModules(content: string): boolean {
    return /\b(import|export)\b/.test(content);
  }

  /**
   * Check if file has named exports
   */
  private hasNamedExports(content: string): boolean {
    return /export\s+(const|let|var|function|class)\s+\w+/.test(content);
  }

  /**
   * Check if file has default export
   */
  private hasDefaultExport(content: string): boolean {
    return /export\s+default\b/.test(content);
  }

  /**
   * Check if file uses CommonJS
   */
  private usesCommonJS(content: string): boolean {
    return /\b(require\(|module\.exports\s*=)/.test(content);
  }

  /**
   * Detect side effects in code
   */
  private detectSideEffects(content: string, filePath: string): SideEffect[] {
    const sideEffects: SideEffect[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Detect console statements at top level
      if (/^\s*console\.(log|warn|error|info)/.test(line)) {
        sideEffects.push({
          file: filePath,
          line: lineNumber,
          code: line.trim(),
          type: 'console',
          severity: 'warning',
        });
      }

      // Detect global mutations
      if (/^\s*window\.|^\s*global\./.test(line) && !line.includes('//')) {
        sideEffects.push({
          file: filePath,
          line: lineNumber,
          code: line.trim(),
          type: 'global-mutation',
          severity: 'error',
        });
      }

      // Detect top-level function calls (potential side effects)
      if (/^\s*\w+\([^)]*\);\s*$/.test(line) && !line.includes('//')) {
        // Exclude common safe calls
        if (!/(import|export|require|describe|it|test)/.test(line)) {
          sideEffects.push({
            file: filePath,
            line: lineNumber,
            code: line.trim(),
            type: 'top-level-call',
            severity: 'warning',
          });
        }
      }
    }

    return sideEffects;
  }

  /**
   * Check package.json for tree-shaking config
   */
  private checkPackageJson(): boolean {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return 'sideEffects' in packageJson;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate tree-shaking score (0-100)
   */
  private calculateScore(
    usesESModules: boolean,
    hasNamedExports: boolean,
    hasDefaultExport: boolean,
    hasSideEffects: boolean,
    packageJsonConfigured: boolean
  ): TreeShakeScore {
    let score = 0;

    // ES modules: 40 points
    if (usesESModules) score += 40;

    // Named exports: 20 points
    if (hasNamedExports) score += 20;

    // No default export: 15 points
    if (!hasDefaultExport) score += 15;

    // No side effects: 15 points
    if (!hasSideEffects) score += 15;

    // Package.json configured: 10 points
    if (packageJsonConfigured) score += 10;

    return {
      score,
      usesESModules,
      hasNamedExports,
      hasDefaultExport,
      hasSideEffects,
      packageJsonConfigured,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    score: TreeShakeScore,
    issues: TreeShakeIssue[],
    sideEffects: SideEffect[]
  ): string[] {
    const recommendations: string[] = [];

    if (!score.usesESModules) {
      recommendations.push('Convert CommonJS (require/module.exports) to ES6 modules (import/export)');
    }

    if (score.hasDefaultExport) {
      recommendations.push('Replace default exports with named exports for better tree-shaking');
    }

    if (score.hasSideEffects) {
      recommendations.push(
        `Remove ${sideEffects.length} side effect(s) - wrap in functions or remove console.log statements`
      );
    }

    if (!score.packageJsonConfigured) {
      recommendations.push('Add "sideEffects": false to package.json');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your code is well optimized for tree-shaking!');
    }

    return recommendations;
  }

  /**
   * Estimate bundle size improvement
   */
  private estimateImprovement(issues: TreeShakeIssue[], sideEffects: SideEffect[]): number {
    // Rough estimates
    let improvement = 0;

    // Each default export costs ~5KB on average
    const defaultExportIssues = issues.filter(i => i.issue.includes('default export'));
    improvement += defaultExportIssues.length * 5 * 1024;

    // Each side effect costs ~2KB on average
    improvement += sideEffects.length * 2 * 1024;

    // CommonJS costs ~10KB on average
    const commonJSIssues = issues.filter(i => i.issue.includes('CommonJS'));
    improvement += commonJSIssues.length * 10 * 1024;

    return improvement;
  }
}
