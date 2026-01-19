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
  private allSourceFiles: string[] = [];

  constructor(projectRoot: string, bundledModulePaths: string[]) {
    this.projectRoot = projectRoot;
    this.bundledModules = new Set(bundledModulePaths.map(p => this.normalizePath(p)));
    
    // Pre-load all source files for better analysis
    const srcDir = path.join(this.projectRoot, 'src');
    if (fs.existsSync(srcDir)) {
      this.allSourceFiles = this.getAllSourceFiles(srcDir);
    }
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
      
      // Check if this file is actually used using multiple strategies
      const isUsed = await this.isFileActuallyUsed(file, relativePath);

      if (!isUsed) {
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
   * Check if a file is actually used using multiple detection strategies
   */
  private async isFileActuallyUsed(filePath: string, relativePath: string): Promise<boolean> {
    // Strategy 1: Check if file is imported by other files
    const isImported = await this.isFileImportedByOthers(filePath, relativePath);
    if (isImported) return true;

    // Strategy 2: Check if it's an entry point or special file
    if (this.isSpecialFile(relativePath)) return true;

    // Strategy 3: Check if it exports something that's used elsewhere
    const exportsUsedElsewhere = await this.areExportsUsedElsewhere(filePath, relativePath);
    if (exportsUsedElsewhere) return true;

    // Strategy 4: Check if it's referenced in bundle (fallback to original logic but more lenient)
    const normalized = this.normalizePath(relativePath);
    const bundledPaths = Array.from(this.bundledModules);
    
    // More flexible matching
    const isInBundle = bundledPaths.some(bundledPath => {
      const normalizedBundle = this.normalizePath(bundledPath);
      
      // Check various path combinations
      return normalizedBundle.includes(normalized) || 
             normalized.includes(normalizedBundle) ||
             this.pathsMatch(normalized, normalizedBundle);
    });

    return isInBundle;
  }

  /**
   * Check if a file is imported by other files in the project
   */
  private async isFileImportedByOthers(targetFile: string, targetRelativePath: string): Promise<boolean> {
    const srcDir = path.join(this.projectRoot, 'src');
    const allFiles = this.getAllSourceFiles(srcDir);
    
    // Get possible import paths for this file
    const possibleImportPaths = this.getPossibleImportPaths(targetRelativePath);
    
    for (const file of allFiles) {
      if (file === targetFile) continue; // Skip self
      
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check if any of the possible import paths are used
        for (const importPath of possibleImportPaths) {
          const importPatterns = [
            new RegExp(`import.*from\\s*['"\`]${this.escapeRegex(importPath)}['"\`]`, 'g'),
            new RegExp(`require\\s*\\(\\s*['"\`]${this.escapeRegex(importPath)}['"\`]\\s*\\)`, 'g'),
            new RegExp(`import\\s*\\(\\s*['"\`]${this.escapeRegex(importPath)}['"\`]\\s*\\)`, 'g'), // dynamic import
          ];
          
          for (const pattern of importPatterns) {
            if (pattern.test(content)) {
              return true;
            }
          }
        }
      } catch (error) {
        // Ignore files we can't read
      }
    }
    
    return false;
  }

  /**
   * Get all possible import paths for a file
   */
  private getPossibleImportPaths(relativePath: string): string[] {
    const paths: string[] = [];
    const parsed = path.parse(relativePath);
    
    // Remove src/ prefix if present
    const withoutSrc = relativePath.startsWith('src/') ? relativePath.substring(4) : relativePath;
    
    // Add various possible import formats
    paths.push(`./${withoutSrc}`);
    paths.push(`../${withoutSrc}`);
    paths.push(`../../${withoutSrc}`);
    paths.push(`../../../${withoutSrc}`);
    paths.push(withoutSrc);
    
    // Without extension
    const withoutExt = path.join(parsed.dir, parsed.name);
    const withoutExtAndSrc = withoutExt.startsWith('src/') ? withoutExt.substring(4) : withoutExt;
    
    paths.push(`./${withoutExtAndSrc}`);
    paths.push(`../${withoutExtAndSrc}`);
    paths.push(`../../${withoutExtAndSrc}`);
    paths.push(`../../../${withoutExtAndSrc}`);
    paths.push(withoutExtAndSrc);
    
    // If it's an index file, also check directory imports
    if (parsed.name === 'index') {
      const dirPath = parsed.dir;
      const dirWithoutSrc = dirPath.startsWith('src/') ? dirPath.substring(4) : dirPath;
      paths.push(`./${dirWithoutSrc}`);
      paths.push(`../${dirWithoutSrc}`);
      paths.push(`../../${dirWithoutSrc}`);
      paths.push(dirWithoutSrc);
    }
    
    return paths;
  }

  /**
   * Check if file is a special file that should not be marked as unused
   */
  private isSpecialFile(relativePath: string): boolean {
    const specialFiles = [
      'src/index',
      'src/app',
      'src/main',
      'index.js',
      'index.ts',
      'index.tsx',
      'App.js',
      'App.ts',
      'App.tsx',
    ];
    
    const specialPatterns = [
      /\/index\.(js|ts|tsx)$/,
      /App\.(js|ts|tsx)$/,
      /\.d\.ts$/,
      /\.config\.(js|ts)$/,
      /\.test\.(js|ts|tsx)$/,
      /\.spec\.(js|ts|tsx)$/,
    ];
    
    return specialFiles.some(special => relativePath.includes(special)) ||
           specialPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Check if exports from this file are used elsewhere
   */
  private async areExportsUsedElsewhere(targetFile: string, targetRelativePath: string): Promise<boolean> {
    try {
      const content = fs.readFileSync(targetFile, 'utf-8');
      
      // Extract export names
      const exports = this.extractExportNames(content);
      if (exports.length === 0) return false;
      
      // Check if any exports are imported elsewhere
      const srcDir = path.join(this.projectRoot, 'src');
      const allFiles = this.getAllSourceFiles(srcDir);
      
      for (const file of allFiles) {
        if (file === targetFile) continue;
        
        try {
          const fileContent = fs.readFileSync(file, 'utf-8');
          
          for (const exportName of exports) {
            // Check for named imports
            const namedImportPattern = new RegExp(`import\\s*{[^}]*\\b${exportName}\\b[^}]*}`, 'g');
            if (namedImportPattern.test(fileContent)) {
              return true;
            }
            
            // Check for usage after import
            const usagePattern = new RegExp(`\\b${exportName}\\b`, 'g');
            if (usagePattern.test(fileContent)) {
              return true;
            }
          }
        } catch (error) {
          // Ignore files we can't read
        }
      }
    } catch (error) {
      // Ignore files we can't read
    }
    
    return false;
  }

  /**
   * Extract export names from file content
   */
  private extractExportNames(content: string): string[] {
    const exports: string[] = [];
    
    // Named exports: export { name1, name2 }
    const namedExportMatches = content.match(/export\s*{\s*([^}]+)\s*}/g);
    if (namedExportMatches) {
      namedExportMatches.forEach(match => {
        const names = match.replace(/export\s*{\s*/, '').replace(/\s*}/, '').split(',');
        names.forEach(name => {
          const cleanName = name.trim().split(' as ')[0].trim();
          if (cleanName) exports.push(cleanName);
        });
      });
    }
    
    // Direct exports: export const name = ...
    const directExportMatches = content.match(/export\s+(const|let|var|function|class)\s+(\w+)/g);
    if (directExportMatches) {
      directExportMatches.forEach(match => {
        const nameMatch = match.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/);
        if (nameMatch) exports.push(nameMatch[1]);
      });
    }
    
    return exports;
  }

  /**
   * Check if two paths match with flexible comparison
   */
  private pathsMatch(path1: string, path2: string): boolean {
    // Remove common prefixes/suffixes and compare
    const clean1 = path1.replace(/^(src\/|\.\/|node_modules\/)/, '').replace(/\.(js|ts|tsx|jsx)$/, '');
    const clean2 = path2.replace(/^(src\/|\.\/|node_modules\/)/, '').replace(/\.(js|ts|tsx|jsx)$/, '');
    
    return clean1 === clean2 || 
           clean1.includes(clean2) || 
           clean2.includes(clean1);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

        // Check if this dependency is in the bundle using multiple strategies
        const isInBundle = this.isDependencyInBundle(depName);

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
   * Check if a dependency is actually used in the bundle using multiple strategies
   */
  private isDependencyInBundle(depName: string): boolean {
    const bundledPaths = Array.from(this.bundledModules);
    
    // Strategy 1: Direct node_modules path match
    const directMatch = bundledPaths.some(bundledPath =>
      bundledPath.includes(`node_modules/${depName}`)
    );
    if (directMatch) return true;

    // Strategy 2: Check if any source files import this dependency
    const isImportedInSource = this.checkIfDependencyImportedInSource(depName);
    if (isImportedInSource) return true;

    // Strategy 3: For scoped packages, check without scope
    if (depName.startsWith('@')) {
      const withoutScope = depName.split('/')[1];
      const scopedMatch = bundledPaths.some(bundledPath =>
        bundledPath.includes(withoutScope)
      );
      if (scopedMatch) return true;
    }

    // Strategy 4: Check for common aliases or transformed names
    const aliases = this.getCommonAliases(depName);
    for (const alias of aliases) {
      const aliasMatch = bundledPaths.some(bundledPath =>
        bundledPath.toLowerCase().includes(alias.toLowerCase())
      );
      if (aliasMatch) return true;
    }

    return false;
  }

  /**
   * Check if dependency is imported in source files
   */
  private checkIfDependencyImportedInSource(depName: string): boolean {
    const srcDir = path.join(this.projectRoot, 'src');
    if (!fs.existsSync(srcDir)) {
      return false;
    }

    const sourceFiles = this.getAllSourceFiles(srcDir);
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for various import patterns
        const importPatterns = [
          new RegExp(`import.*from\\s*['"\`]${depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`, 'g'),
          new RegExp(`require\\s*\\(\\s*['"\`]${depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*\\)`, 'g'),
          new RegExp(`import.*from\\s*['"\`]${depName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g'),
        ];

        for (const pattern of importPatterns) {
          if (pattern.test(content)) {
            return true;
          }
        }
      } catch (error) {
        // Ignore files we can't read
      }
    }

    return false;
  }

  /**
   * Get common aliases for package names
   */
  private getCommonAliases(depName: string): string[] {
    const aliases: string[] = [];
    
    // For scoped packages, add the package name without scope
    if (depName.startsWith('@')) {
      const parts = depName.split('/');
      if (parts.length === 2) {
        aliases.push(parts[1]);
      }
    }

    // Common transformations
    aliases.push(depName.replace(/-/g, ''));  // remove dashes
    aliases.push(depName.replace(/-/g, '_')); // dashes to underscores
    
    // Specific known aliases
    const knownAliases: Record<string, string[]> = {
      '@gorhom/bottom-sheet': ['bottomsheet', 'bottom-sheet', 'BottomSheet'],
      '@react-native-community/netinfo': ['netinfo', 'NetInfo'],
      '@react-native-clipboard/clipboard': ['clipboard', 'Clipboard'],
      '@notifee/react-native': ['notifee', 'Notifee'],
      'react-native-vector-icons': ['vectoricons', 'vector-icons'],
    };

    if (knownAliases[depName]) {
      aliases.push(...knownAliases[depName]);
    }

    return aliases;
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
      '@babel/',
      'babel-',
      'webpack',
      'rollup',
      '@rollup/',
      'vite',
      'postcss',
      'tailwindcss',
      'react-native-flipper',
      'flipper',
      '@react-native/metro-config',
      'react-native-gradle-plugin',
    ];

    // Skip dev dependencies that are build tools
    const devToolPatterns = [
      /^@types\//,
      /eslint/,
      /babel/,
      /webpack/,
      /metro/,
      /jest/,
      /testing/,
      /storybook/,
      /husky/,
      /lint-staged/,
      /commitizen/,
      /semantic-release/,
    ];

    return skipList.some(skip => depName.includes(skip)) ||
           devToolPatterns.some(pattern => pattern.test(depName));
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
