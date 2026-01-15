import * as fs from 'fs';
import * as path from 'path';

export interface UnusedFile {
  path: string;
  size: number;
  reason: string;
}

export interface UnusedDependency {
  name: string;
  installedVersion: string;
  estimatedSize: number;
  reason: string;
}

export interface UnusedExport {
  file: string;
  exportName: string;
  line: number;
  estimatedSize: number;
}

export interface DeadCodeAnalysis {
  unusedFiles: UnusedFile[];
  unusedDependencies: UnusedDependency[];
  unusedExports: UnusedExport[];
  totalSavings: number;
}

export class DeadCodeAnalyzer {
  private projectRoot: string;
  private bundledModules: Set<string>;

  constructor(projectRoot: string, bundledModulePaths: string[]) {
    this.projectRoot = projectRoot;
    this.bundledModules = new Set(bundledModulePaths.map(p => this.normalizePath(p)));
  }

  /**
   * Analyze project for dead code
   */
  async analyze(): Promise<DeadCodeAnalysis> {
    const unusedFiles = await this.findUnusedFiles();
    const unusedDependencies = await this.findUnusedDependencies();
    const unusedExports = await this.findUnusedExports();

    const totalSavings =
      unusedFiles.reduce((sum, f) => sum + f.size, 0) +
      unusedDependencies.reduce((sum, d) => sum + d.estimatedSize, 0) +
      unusedExports.reduce((sum, e) => sum + e.estimatedSize, 0);

    return {
      unusedFiles,
      unusedDependencies,
      unusedExports,
      totalSavings,
    };
  }

  /**
   * Find files in src/ that aren't in the bundle
   */
  private async findUnusedFiles(): Promise<UnusedFile[]> {
    const unusedFiles: UnusedFile[] = [];
    const srcDir = path.join(this.projectRoot, 'src');

    if (!fs.existsSync(srcDir)) {
      return unusedFiles;
    }

    const allFiles = this.getAllSourceFiles(srcDir);

    for (const file of allFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      const normalized = this.normalizePath(relativePath);

      // Check if this file is in the bundle
      const isInBundle = Array.from(this.bundledModules).some(bundledPath =>
        bundledPath.includes(normalized) || normalized.includes(bundledPath)
      );

      if (!isInBundle) {
        try {
          const stats = fs.statSync(file);
          unusedFiles.push({
            path: relativePath,
            size: stats.size,
            reason: 'Not imported anywhere or not reachable from entry point',
          });
        } catch (error) {
          // Ignore files we can't stat
        }
      }
    }

    return unusedFiles;
  }

  /**
   * Find dependencies that are installed but not in bundle
   */
  private async findUnusedDependencies(): Promise<UnusedDependency[]> {
    const unusedDeps: UnusedDependency[] = [];
    const packageJsonPath = path.join(this.projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return unusedDeps;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [depName, version] of Object.entries(allDeps)) {
        // Skip certain packages that are used differently
        if (this.shouldSkipDependencyCheck(depName)) {
          continue;
        }

        // Check if this dependency is in the bundle
        const isInBundle = Array.from(this.bundledModules).some(bundledPath =>
          bundledPath.includes(`node_modules/${depName}`)
        );

        if (!isInBundle) {
          const estimatedSize = await this.estimateDependencySize(depName);
          unusedDeps.push({
            name: depName,
            installedVersion: version as string,
            estimatedSize,
            reason: 'Installed but never imported in bundled code',
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
    }

    return unusedDeps;
  }

  /**
   * Find exported functions/components that are never imported
   */
  private async findUnusedExports(): Promise<UnusedExport[]> {
    // This would require deeper AST analysis
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Get all source files recursively
   */
  private getAllSourceFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, build directories, etc.
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '__tests__'
          ) {
            continue;
          }
          files.push(...this.getAllSourceFiles(fullPath));
        } else if (entry.isFile()) {
          // Only include source files
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
      // Ignore errors reading directory
    }

    return files;
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Check if dependency should be skipped from unused check
   */
  private shouldSkipDependencyCheck(depName: string): boolean {
    const skipList = [
      '@types/',
      'typescript',
      'eslint',
      'prettier',
      'jest',
      '@testing-library',
      'metro',
      '@react-native-community/cli',
      'react-native-codegen',
    ];

    return skipList.some(skip => depName.includes(skip));
  }

  /**
   * Estimate dependency size from node_modules
   */
  private async estimateDependencySize(depName: string): Promise<number> {
    const depPath = path.join(this.projectRoot, 'node_modules', depName);

    if (!fs.existsSync(depPath)) {
      return 0;
    }

    try {
      // Get size of package directory
      return this.getDirectorySize(depPath);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate directory size recursively
   */
  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += this.getDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return totalSize;
  }
}
