import * as fs from 'fs';
import * as path from 'path';

export interface DependencyUsage {
  name: string;
  version: string;
  isUsed: boolean;
  usageCount: number; // Total number of imports
  filesUsing: string[]; // List of files that import this dependency
  usagePercentage: number; // % of project files that use this dependency
}

export interface UnusedImport {
  file: string;
  line: number;
  importName: string;
  importStatement: string;
}

export interface SourceAnalysisResult {
  usedDependencies: string[];
  unusedDependencies: string[];
  importedFiles: Set<string>;
  allFiles: string[];
  unusedFiles: string[];
  // Step 1: Detailed dependency usage
  dependencyUsages: DependencyUsage[];
  totalDependencies: number;
  totalProjectFiles: number;
  // NEW: Unused imports within files
  unusedImports: UnusedImport[];
}

/**
 * Analyzes source code directly without relying on bundle parsing
 * This provides accurate results for dependency and file usage
 */
export class SourceCodeAnalyzer {
  private projectRoot: string;
  private allSourceFiles: string[] = [];
  private fileContents: Map<string, string> = new Map();
  private importGraph: Map<string, Set<string>> = new Map();
  private pathAliases: Map<string, string> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.loadPathAliases();
    this.loadSourceFiles();
  }

  /**
   * Load path aliases from tsconfig.json
   */
  private loadPathAliases(): void {
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
      return;
    }

    try {
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
      // Remove comments (simple approach)
      const cleanContent = tsconfigContent.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const tsconfig = JSON.parse(cleanContent);

      const paths = tsconfig.compilerOptions?.paths;
      if (paths) {
        for (const [alias, targets] of Object.entries(paths)) {
          if (Array.isArray(targets) && targets.length > 0) {
            // Remove trailing /* from alias and target
            const cleanAlias = alias.replace(/\/\*$/, '');
            const cleanTarget = (targets[0] as string).replace(/\/\*$/, '');

            // Resolve target relative to project root
            const resolvedTarget = path.join(this.projectRoot, cleanTarget);
            this.pathAliases.set(cleanAlias, resolvedTarget);

            console.log(`✅ Path alias detected: "${cleanAlias}" → "${resolvedTarget}"`);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not parse tsconfig.json for path aliases:', (error as Error).message);
    }
  }

  /**
   * Analyze the project
   */
  analyze(): SourceAnalysisResult {
    console.log('📊 Analyzing source code...');

    // Build import graph
    this.buildImportGraph();

    // Step 1: Analyze dependency usage in detail
    const dependencyUsages = this.analyzeDependencyUsages();

    // Find used dependencies
    const usedDependencies = this.findUsedDependencies();
    const unusedDependencies = this.findUnusedDependencies(usedDependencies);

    // Find imported files
    const importedFiles = this.findAllImportedFiles();
    const unusedFiles = this.findUnusedFiles(importedFiles);

    // NEW: Find unused imports within files
    const unusedImports = this.findUnusedImports();

    return {
      usedDependencies,
      unusedDependencies,
      importedFiles,
      allFiles: this.allSourceFiles,
      unusedFiles,
      // Step 1: Detailed usage info
      dependencyUsages,
      totalDependencies: dependencyUsages.length,
      totalProjectFiles: this.allSourceFiles.length,
      // NEW: Unused imports
      unusedImports,
    };
  }

  /**
   * Load all source files
   */
  private loadSourceFiles(): void {
    const srcDir = path.join(this.projectRoot, 'src');
    if (!fs.existsSync(srcDir)) {
      console.warn('⚠️  No src/ directory found');
      return;
    }

    this.allSourceFiles = this.getAllSourceFiles(srcDir);
    
    // Load file contents
    this.allSourceFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        this.fileContents.set(file, content);
      } catch (error) {
        // Ignore files we can't read
      }
    });

    console.log(`✅ Loaded ${this.allSourceFiles.length} source files`);
  }

  /**
   * Build import graph
   */
  private buildImportGraph(): void {
    for (const [file, content] of this.fileContents.entries()) {
      const imports = this.extractImports(content, file);
      this.importGraph.set(file, imports);
    }
  }

  /**
   * Extract all imports from a file
   */
  private extractImports(content: string, currentFile: string): Set<string> {
    const imports = new Set<string>();
    const currentDir = path.dirname(currentFile);

    // Match ES6 imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    // Match require statements
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    // Match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    // Match re-exports: export { ... } from '...' or export * from '...'
    const reExportRegex = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"`]([^'"`]+)['"`]/g;

    let match;

    // Extract ES6 imports
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Skip if it contains template variables or invalid characters
      if (this.isValidImportPath(importPath)) {
        if (importPath.startsWith('.')) {
          // Relative import - resolve to absolute path
          const resolved = this.resolveImportPath(importPath, currentDir);
          if (resolved) imports.add(resolved);
        } else {
          // Check if it's a path alias (e.g., @/services/...)
          const aliasResolved = this.resolvePathAlias(importPath);
          if (aliasResolved) {
            imports.add(aliasResolved);
          } else {
            // Package import
            imports.add(importPath);
          }
        }
      }
    }

    // Extract require statements
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (this.isValidImportPath(importPath)) {
        if (importPath.startsWith('.')) {
          const resolved = this.resolveImportPath(importPath, currentDir);
          if (resolved) imports.add(resolved);
        } else {
          const aliasResolved = this.resolvePathAlias(importPath);
          if (aliasResolved) {
            imports.add(aliasResolved);
          } else {
            imports.add(importPath);
          }
        }
      }
    }

    // Extract dynamic imports
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (this.isValidImportPath(importPath)) {
        if (importPath.startsWith('.')) {
          const resolved = this.resolveImportPath(importPath, currentDir);
          if (resolved) imports.add(resolved);
        } else {
          const aliasResolved = this.resolvePathAlias(importPath);
          if (aliasResolved) {
            imports.add(aliasResolved);
          } else {
            imports.add(importPath);
          }
        }
      }
    }

    // Extract re-exports (barrel files)
    while ((match = reExportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (this.isValidImportPath(importPath)) {
        if (importPath.startsWith('.')) {
          const resolved = this.resolveImportPath(importPath, currentDir);
          if (resolved) imports.add(resolved);
        } else {
          const aliasResolved = this.resolvePathAlias(importPath);
          if (aliasResolved) {
            imports.add(aliasResolved);
          } else {
            imports.add(importPath);
          }
        }
      }
    }

    return imports;
  }

  /**
   * Check if import path is valid (not a template literal or invalid string)
   */
  private isValidImportPath(importPath: string): boolean {
    // Skip if empty
    if (!importPath || importPath.trim() === '') return false;

    // Skip template literals (${...})
    if (importPath.includes('${') || importPath.includes('}')) return false;

    // Skip if contains spaces (likely not a real import)
    if (importPath.includes(' ')) return false;

    // Skip URLs
    if (importPath.startsWith('http://') || importPath.startsWith('https://')) return false;

    // Skip file extensions that aren't code
    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.mp4', '.mov', '.avi'];
    if (invalidExtensions.some(ext => importPath.toLowerCase().endsWith(ext))) return false;

    return true;
  }

  /**
   * Resolve path alias to absolute file path
   * Example: @/services/fetchInstance → /project/src/services/fetchInstance.ts
   */
  private resolvePathAlias(importPath: string): string | null {
    for (const [alias, target] of this.pathAliases.entries()) {
      if (importPath.startsWith(alias)) {
        // Replace alias with target path
        const relativePath = importPath.substring(alias.length);
        const fullPath = path.join(target, relativePath);

        // Try to resolve with extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
        for (const ext of extensions) {
          const filePath = fullPath + ext;
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return filePath;
          }

          // Try as directory with index
          const indexPath = path.join(fullPath, 'index' + ext);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
      }
    }

    return null;
  }

  /**
   * Resolve relative import path to absolute file path
   */
  private resolveImportPath(importPath: string, fromDir: string): string | null {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];

    for (const ext of extensions) {
      // Try as file
      const filePath = path.resolve(fromDir, importPath + ext);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }

      // Try as directory with index
      const indexPath = path.resolve(fromDir, importPath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Find all dependencies that are actually used
   */
  private findUsedDependencies(): string[] {
    const usedDeps = new Set<string>();

    for (const imports of this.importGraph.values()) {
      for (const imp of imports) {
        // Check if it's a package import (not a file path)
        if (!imp.startsWith('/') && !imp.startsWith('.')) {
          // Extract base package name
          const packageName = this.extractPackageName(imp);
          if (packageName) {
            usedDeps.add(packageName);
          }
        }
      }
    }

    return Array.from(usedDeps).sort();
  }

  /**
   * Extract package name from import path
   */
  private extractPackageName(importPath: string): string | null {
    // Handle scoped packages (@scope/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }

    // Handle regular packages
    const parts = importPath.split('/');
    return parts[0];
  }

  /**
   * Step 1: Analyze detailed usage of each dependency
   */
  private analyzeDependencyUsages(): DependencyUsage[] {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return [];
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const dependencies = packageJson.dependencies || {};
      const usages: DependencyUsage[] = [];

      for (const [depName, version] of Object.entries(dependencies)) {
        // Skip packages that shouldn't be checked (same as findUnusedDependencies)
        if (this.shouldSkipDependency(depName)) {
          continue;
        }

        const usage = this.analyzeSingleDependency(depName, version as string);
        usages.push(usage);
      }

      // Sort by status first (used first, then unused), then by usage count
      return usages.sort((a, b) => {
        // If one is used and other is unused, used comes first
        if (a.isUsed && !b.isUsed) return -1;
        if (!a.isUsed && b.isUsed) return 1;

        // If both have same status, sort by usage count (descending)
        return b.usageCount - a.usageCount;
      });
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
      return [];
    }
  }

  /**
   * Analyze how a specific dependency is used
   */
  private analyzeSingleDependency(depName: string, version: string): DependencyUsage {
    const filesUsing: string[] = [];
    let usageCount = 0;

    // Go through import graph and count usage
    for (const [file, imports] of this.importGraph.entries()) {
      let fileUsesThisDep = false;

      for (const imp of imports) {
        // Check if import is from this package
        if (!imp.startsWith('/') && !imp.startsWith('.')) {
          const packageName = this.extractPackageName(imp);
          if (packageName === depName) {
            usageCount++;
            fileUsesThisDep = true;
          }
        }
      }

      if (fileUsesThisDep) {
        const relativePath = path.relative(this.projectRoot, file);
        filesUsing.push(relativePath);
      }
    }

    const usagePercentage = this.allSourceFiles.length > 0
      ? (filesUsing.length / this.allSourceFiles.length) * 100
      : 0;

    return {
      name: depName,
      version,
      isUsed: usageCount > 0,
      usageCount,
      filesUsing,
      usagePercentage: parseFloat(usagePercentage.toFixed(2)),
    };
  }

  /**
   * Find unused dependencies
   */
  private findUnusedDependencies(usedDependencies: string[]): string[] {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return [];
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const dependencies = packageJson.dependencies || {};
      
      const unusedDeps: string[] = [];

      for (const depName of Object.keys(dependencies)) {
        // Skip packages that shouldn't be checked
        if (this.shouldSkipDependency(depName)) {
          continue;
        }

        // Check if it's in the used list
        if (!usedDependencies.includes(depName)) {
          unusedDeps.push(depName);
        }
      }

      return unusedDeps.sort();
    } catch (error) {
      console.error('Error reading package.json:', error);
      return [];
    }
  }

  /**
   * Check if dependency should be skipped
   */
  private shouldSkipDependency(depName: string): boolean {
    const skipPatterns = [
      'react',
      'react-native',
      '@types/',
      'typescript',
      'eslint',
      'prettier',
      'jest',
      '@testing-library',
      'metro',
      '@react-native-community/cli',
      '@babel/',
      'babel-',
    ];

    return skipPatterns.some(pattern => depName.includes(pattern));
  }

  /**
   * Find all files that are imported (directly or indirectly)
   * NEW APPROACH: Collect ALL imports from ALL files, then check if each file is referenced
   */
  private findAllImportedFiles(): Set<string> {
    const imported = new Set<string>();

    // Step 1: Collect ALL file imports from ALL files in the project
    for (const [file, imports] of this.importGraph.entries()) {
      for (const imp of imports) {
        // Only process file imports (absolute paths - these are resolved local files)
        if (imp.startsWith('/')) {
          imported.add(imp);
        }
      }
    }

    // Step 2: Also add entry points as they are always "imported" by the app
    const entryPoints = this.findEntryPoints();
    entryPoints.forEach(entry => imported.add(entry));

    console.log(`✅ Found ${imported.size} imported files across entire project`);

    return imported;
  }

  /**
   * Find entry point files
   */
  private findEntryPoints(): string[] {
    const entryPoints: string[] = [];
    const possibleEntries = [
      'index.js',
      'index.ts',
      'index.tsx',
      'App.js',
      'App.ts',
      'App.tsx',
      'src/index.js',
      'src/index.ts',
      'src/index.tsx',
      'src/App.js',
      'src/App.ts',
      'src/App.tsx',
    ];

    for (const entry of possibleEntries) {
      const fullPath = path.join(this.projectRoot, entry);
      if (fs.existsSync(fullPath)) {
        entryPoints.push(fullPath);
      }
    }

    // Add navigation entry points to detect dynamically imported screens
    const navigationEntries = this.findNavigationEntryPoints();
    entryPoints.push(...navigationEntries);

    console.log(`✅ Found ${entryPoints.length} entry points (${navigationEntries.length} navigation files)`);

    return entryPoints;
  }

  /**
   * Find navigation entry points (stack/tab navigators)
   * These files often use dynamic imports or object configurations
   */
  private findNavigationEntryPoints(): string[] {
    const navigationFiles: string[] = [];
    const srcDir = path.join(this.projectRoot, 'src');

    if (!fs.existsSync(srcDir)) {
      return [];
    }

    // Common navigation patterns
    const navigationPatterns = [
      /navigation.*index\.(ts|tsx|js|jsx)$/i,
      /navigation.*stack\.(ts|tsx|js|jsx)$/i,
      /navigation.*tab\.(ts|tsx|js|jsx)$/i,
      /navigation.*drawer\.(ts|tsx|js|jsx)$/i,
      /routes.*index\.(ts|tsx|js|jsx)$/i,
      /router\.(ts|tsx|js|jsx)$/i,
      /App\.navigation\.(ts|tsx|js|jsx)$/i,
    ];

    // Search for navigation files
    for (const file of this.allSourceFiles) {
      const relativePath = path.relative(this.projectRoot, file);

      // Check if file matches navigation patterns
      if (navigationPatterns.some(pattern => pattern.test(relativePath))) {
        navigationFiles.push(file);
        console.log(`  📍 Navigation entry point: ${relativePath}`);
      }
    }

    return navigationFiles;
  }

  /**
   * Find unused files
   */
  private findUnusedFiles(importedFiles: Set<string>): string[] {
    const unusedFiles: string[] = [];

    // Extract all imported component/module names from all files
    const importedNames = this.extractAllImportedNames();

    for (const file of this.allSourceFiles) {
      // Skip test files and special files
      if (this.isSpecialFile(file)) {
        continue;
      }

      // Skip navigation pattern files (likely dynamically imported)
      if (this.isNavigationPatternFile(file)) {
        continue;
      }

      // Check if file is in import graph
      if (importedFiles.has(file)) {
        continue;
      }

      // Additional check: fuzzy match with imported names (first 3 + last 3 chars)
      const fileName = path.basename(file, path.extname(file));
      if (this.isLikelyUsedByFuzzyMatch(fileName, importedNames)) {
        continue;
      }

      const relativePath = path.relative(this.projectRoot, file);
      unusedFiles.push(relativePath);
    }

    return unusedFiles.sort();
  }

  /**
   * Check if file matches navigation patterns (screens, routes)
   * These are often dynamically imported and may appear unused
   */
  private isNavigationPatternFile(filePath: string): boolean {
    const relativePath = path.relative(this.projectRoot, filePath);

    const navigationPatterns = [
      /src\/screens\/.*\/index\.(ts|tsx|js|jsx)$/,
      /src\/navigation\//,
      /src\/routes\//,
      /\.route\.(ts|tsx|js|jsx)$/,
      /\.screen\.(ts|tsx|js|jsx)$/,
    ];

    return navigationPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * Extract all imported component/module names from all files
   */
  private extractAllImportedNames(): Set<string> {
    const names = new Set<string>();

    for (const [file, content] of this.fileContents.entries()) {
      // Match named imports: import { Name1, Name2 } from '...'
      const namedImportRegex = /import\s+\{([^}]+)\}\s+from/g;
      // Match default imports: import Name from '...'
      const defaultImportRegex = /import\s+(\w+)\s+from/g;
      // Match namespace imports: import * as Name from '...'
      const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from/g;
      // Match re-exports: export { Name1, Name2 } from '...'
      const reExportRegex = /export\s+\{([^}]+)\}\s+from/g;

      let match;

      // Extract named imports
      while ((match = namedImportRegex.exec(content)) !== null) {
        const imports = match[1].split(',');
        imports.forEach(imp => {
          // Handle "Name as Alias" and just "Name"
          const name = imp.trim().split(/\s+as\s+/)[0].trim();
          if (name) names.add(name);
        });
      }

      // Extract default imports
      while ((match = defaultImportRegex.exec(content)) !== null) {
        const name = match[1].trim();
        if (name) names.add(name);
      }

      // Extract namespace imports
      while ((match = namespaceImportRegex.exec(content)) !== null) {
        const name = match[1].trim();
        if (name) names.add(name);
      }

      // Extract re-exported names (barrel files)
      while ((match = reExportRegex.exec(content)) !== null) {
        const exports = match[1].split(',');
        exports.forEach(exp => {
          // Handle "Name as Alias" and just "Name"
          const name = exp.trim().split(/\s+as\s+/)[0].trim();
          if (name) names.add(name);
        });
      }
    }

    return names;
  }

  /**
   * Check if a file name likely matches an imported name using fuzzy matching
   * Matches if first 3 and last 3 characters are the same (case-insensitive)
   */
  private isLikelyUsedByFuzzyMatch(fileName: string, importedNames: Set<string>): boolean {
    if (fileName.length < 6) {
      // For short names, require exact match
      return importedNames.has(fileName);
    }

    const fileFirst3 = fileName.substring(0, 3).toLowerCase();
    const fileLast3 = fileName.substring(fileName.length - 3).toLowerCase();

    for (const importedName of importedNames) {
      if (importedName.length < 6) {
        // Exact match for short names
        if (importedName.toLowerCase() === fileName.toLowerCase()) {
          return true;
        }
        continue;
      }

      const importFirst3 = importedName.substring(0, 3).toLowerCase();
      const importLast3 = importedName.substring(importedName.length - 3).toLowerCase();

      if (fileFirst3 === importFirst3 && fileLast3 === importLast3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if file is special (tests, configs, etc.)
   */
  private isSpecialFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(this.projectRoot, filePath);

    const specialPatterns = [
      /\.test\.(js|ts|tsx)$/,
      /\.spec\.(js|ts|tsx)$/,
      /\.d\.ts$/,
      /\.config\.(js|ts)$/,
      /__tests__/,
      /__mocks__/,
    ];

    return specialPatterns.some(pattern => 
      pattern.test(fileName) || pattern.test(relativePath)
    );
  }

  /**
   * Find unused imports within each file
   */
  private findUnusedImports(): UnusedImport[] {
    const unusedImports: UnusedImport[] = [];

    for (const [file, content] of this.fileContents.entries()) {
      const relativePath = path.relative(this.projectRoot, file);

      // Extract all imported names from this file
      const importedNames = this.extractImportedNamesFromFile(content);

      // Check if each imported name is actually used in the file
      for (const { name, line, statement } of importedNames) {
        if (!this.isNameUsedInFile(name, content, statement)) {
          unusedImports.push({
            file: relativePath,
            line,
            importName: name,
            importStatement: statement,
          });
        }
      }
    }

    console.log(`✅ Found ${unusedImports.length} unused imports across all files`);
    return unusedImports;
  }

  /**
   * Check if file has any exports
   */
  private fileHasExports(content: string): boolean {
    // Check for export statements
    const exportPatterns = [
      /export\s+(?:default|const|let|var|function|class|interface|type|enum)/,
      /export\s+\{/,
      /export\s+\*/,
    ];

    return exportPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract imported names with line numbers from a file
   */
  private extractImportedNamesFromFile(content: string): Array<{ name: string; line: number; statement: string }> {
    const imports: Array<{ name: string; line: number; statement: string }> = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Match named imports: import { Name1, Name2 } from '...'
      const namedImportMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`]/);
      if (namedImportMatch) {
        const names = namedImportMatch[1].split(',');
        names.forEach(name => {
          const cleanName = name.trim().split(/\s+as\s+/)[0].trim();
          if (cleanName) {
            imports.push({
              name: cleanName,
              line: lineNumber,
              statement: line.trim(),
            });
          }
        });
      }

      // Match default imports: import Name from '...'
      const defaultImportMatch = line.match(/import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/);
      if (defaultImportMatch && !line.includes('{')) {
        const name = defaultImportMatch[1].trim();
        if (name) {
          imports.push({
            name,
            line: lineNumber,
            statement: line.trim(),
          });
        }
      }

      // Match namespace imports: import * as Name from '...'
      const namespaceImportMatch = line.match(/import\s+\*\s+as\s+(\w+)\s+from/);
      if (namespaceImportMatch) {
        const name = namespaceImportMatch[1].trim();
        if (name) {
          imports.push({
            name,
            line: lineNumber,
            statement: line.trim(),
          });
        }
      }
    });

    return imports;
  }

  /**
   * Check if an imported name is actually used in the file
   */
  private isNameUsedInFile(name: string, content: string, importStatement: string): boolean {
    // Special case: "React" default import is always considered used if file has JSX
    // This is because React is needed for JSX transformation
    if (name === 'React' && this.fileHasJSX(content)) {
      return true;
    }

    // Remove the import statement itself from the content
    const contentWithoutImport = content.replace(importStatement, '');

    // Escape special regex characters in the name
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check for usage patterns:
    const usagePatterns = [
      new RegExp(`<${escapedName}[\\s>/]`),                    // JSX usage: <Button or <Button>
      new RegExp(`${escapedName}\\(`),                          // Function call: Button(
      new RegExp(`${escapedName}\\.`),                          // Object access: Button.
      new RegExp(`[^:]\\b${escapedName}\\b`),                   // Variable usage (not after colon for object keys)
      new RegExp(`typeof\\s+${escapedName}\\b`),                // typeof check
      new RegExp(`instanceof\\s+${escapedName}\\b`),            // instanceof check
      new RegExp(`return\\s+${escapedName}\\b`),                // return statement
      new RegExp(`\\?\\s*${escapedName}\\b`),                   // ternary expression
      new RegExp(`:\\s*${escapedName}\\b`),                     // ternary expression or object value
      new RegExp(`=\\s*${escapedName}\\b`),                     // assignment
      new RegExp(`\\[${escapedName}\\b`),                       // array access
      new RegExp(`\\(${escapedName}\\b`),                       // function argument
      new RegExp(`,\\s*${escapedName}\\b`),                     // function argument or array element
    ];

    return usagePatterns.some(pattern => pattern.test(contentWithoutImport));
  }

  /**
   * Check if file contains JSX
   */
  private fileHasJSX(content: string): boolean {
    // Check for JSX patterns
    return /<[A-Z][a-zA-Z0-9]*[\s>\/]/.test(content) || // Component tags: <Button
           /<[a-z]+[\s>\/]/.test(content);               // HTML tags: <div
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
          // Skip certain directories
          if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '__tests__' ||
            entry.name === 'android' ||
            entry.name === 'ios'
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
      // Ignore errors
    }

    return files;
  }
}
