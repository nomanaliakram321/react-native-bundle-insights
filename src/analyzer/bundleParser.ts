import { ModuleData } from '../types';
import { SourcemapParser } from '../utils/sourcemapParser';

export class BundleParser {
  private bundleContent: string;
  private sourcemapParser?: SourcemapParser;

  constructor(bundleContent: string, sourcemapParser?: SourcemapParser) {
    this.bundleContent = bundleContent;
    this.sourcemapParser = sourcemapParser;
  }

  /**
   * Parse the Metro bundle and extract module information
   */
  parse(): ModuleData[] {
    const modules: ModuleData[] = [];

    try {
      // Split bundle into __d() function calls
      // Production bundles use: __d(function(g,r,i,a,m,e,d){...},ID,[dependencies])
      const parts = this.bundleContent.split('__d(');

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];

        // Try to extract module ID and path
        // Pattern: function(g,r,i,a,m,e,d){...},MODULE_ID,DEPENDENCIES)
        const match = part.match(/^function\([^)]*\)\{([\s\S]*?)\},(\d+),/);

        if (match) {
          const [, moduleBody, moduleIdStr] = match;
          const moduleId = parseInt(moduleIdStr, 10);

          // Try to get path from sourcemap using index (i-1 because we skip part 0)
          // Sourcemap sources array maps to module order, not IDs
          let modulePath = this.getModulePathFromSourcemap(i - 1) ||
                          this.extractModulePath(moduleBody, moduleId);

          // Calculate module size (approximate)
          const endIndex = this.findModuleEnd(part);
          const moduleCode = part.substring(0, endIndex);

          modules.push({
            id: moduleId,
            path: modulePath,
            size: new TextEncoder().encode(moduleCode).length,
          });
        }
      }

      // If we found modules, return them
      if (modules.length > 0) {
        return modules;
      }

      // Fallback to alternative parsing
      return this.parseBySize();
    } catch (error) {
      console.error('Error parsing bundle:', error);
      return this.parseBySize();
    }
  }

  private findModuleEnd(part: string): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < part.length; i++) {
      const char = part[i];
      const prevChar = i > 0 ? part[i - 1] : '';

      // Handle strings
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (!inString) {
        if (char === '{' || char === '(' || char === '[') depth++;
        if (char === '}' || char === ')' || char === ']') depth--;

        // End of module definition
        if (depth < 0) {
          return i;
        }
      }
    }

    return Math.min(part.length, 10000); // Cap at reasonable size
  }

  private getModulePathFromSourcemap(moduleId: number): string | undefined {
    if (!this.sourcemapParser || !this.sourcemapParser.isLoaded()) {
      return undefined;
    }

    const rawPath = this.sourcemapParser.getModulePath(moduleId);
    if (!rawPath) {
      return undefined;
    }

    return SourcemapParser.normalizeModulePath(rawPath);
  }

  private extractModulePath(moduleBody: string, moduleId: number): string {
    // Strategy 1: Look for __d function metadata (common in production bundles)
    // Pattern: __d(function(g,r,i,a,m,e,d){...},"module_path",deps)
    const metadataMatch = moduleBody.match(/^function\([^)]*\)\{.*?\}['"]([^'"]+)['"]/);
    if (metadataMatch) {
      return metadataMatch[1];
    }

    // Strategy 2: Look for module.exports assignments with package indicators
    const exportsMatch = moduleBody.match(/module\.exports\s*=\s*require\(['"]([^'"]+)['"]\)/);
    if (exportsMatch) {
      return exportsMatch[1];
    }

    // Strategy 3: Find any require/import statements
    const requireMatch = moduleBody.match(/(?:require|import)\s*\(['"]([^'"]+)['"]\)/);
    if (requireMatch) {
      const reqPath = requireMatch[1];
      // If it's a package name (doesn't start with . or /), use it
      if (!reqPath.startsWith('.') && !reqPath.startsWith('/')) {
        return `node_modules/${reqPath}`;
      }
      return reqPath;
    }

    // Strategy 4: Look for React component patterns
    if (moduleBody.includes('React.createElement') || moduleBody.includes('_react.default.createElement')) {
      // Check if it's from react-native
      if (moduleBody.includes('react-native') || moduleBody.includes('_reactNative')) {
        return 'node_modules/react-native/index.js';
      }
      return 'src/component_' + moduleId + '.js';
    }

    // Strategy 5: Look for string literals that look like paths
    const pathMatch = moduleBody.match(/['"]([^'"]*(?:node_modules|src|lib)\/[^'"]+)['"]/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Strategy 6: Check for actual package imports/requires (more precise)
    const packageImportPatterns = [
      /(?:require|import).*['"]@react-navigation[^'"]*['"]/,
      /(?:require|import).*['"]@react-native[^'"]*['"]/,
      /(?:require|import).*['"]lodash[^'"]*['"]/,
      /(?:require|import).*['"]moment[^'"]*['"]/,
      /(?:require|import).*['"]axios[^'"]*['"]/,
      /(?:require|import).*['"]redux[^'"]*['"]/,
    ];

    for (const pattern of packageImportPatterns) {
      const match = moduleBody.match(pattern);
      if (match) {
        // Extract the actual package name from the require/import statement
        const importMatch = match[0].match(/['"]([^'"]+)['"]/);
        if (importMatch) {
          const packagePath = importMatch[1];
          // Extract base package name
          const packageName = packagePath.split('/')[0];
          return `node_modules/${packageName}/index.js`;
        }
      }
    }

    // Strategy 7: Look for package names in variable names
    const varMatch = moduleBody.match(/_([a-zA-Z0-9]+)\.default/);
    if (varMatch) {
      return `node_modules/${varMatch[1]}/index.js`;
    }

    // Fallback: Analyze code characteristics to guess type
    if (moduleBody.length < 500) {
      return `src/util_${moduleId}.js`;
    } else if (moduleBody.includes('StyleSheet') || moduleBody.includes('Platform')) {
      return `src/screen_${moduleId}.js`;
    }

    // Generic path as last resort
    return `module_${moduleId}`;
  }

  /**
   * Parse bundle by simply counting __d() calls when detailed parsing fails
   */
  private parseBySize(): ModuleData[] {
    const modules: ModuleData[] = [];
    const parts = this.bundleContent.split('__d(');

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const moduleIndex = i - 1;

      // Extract module ID if possible
      const idMatch = part.match(/^function\([^)]*\)\{[\s\S]*?\},(\d+),/);
      const id = idMatch ? parseInt(idMatch[1], 10) : moduleIndex;

      // Try to get path from sourcemap using index
      let modulePath = this.getModulePathFromSourcemap(moduleIndex);
      if (!modulePath) {
        modulePath = `module_${id}`;
      }

      // Estimate module size (take first ~10KB or until we hit likely end)
      const endIndex = Math.min(part.indexOf('__d(') > 0 ? part.indexOf('__d(') : part.length, 10000);
      const moduleCode = part.substring(0, endIndex);

      modules.push({
        id,
        path: modulePath,
        size: new TextEncoder().encode(moduleCode).length,
      });
    }

    return modules;
  }

  /**
   * Parse alternative Metro bundle formats
   */
  private parseAlternativeFormat(modules: ModuleData[]): void {
    // Try to parse module map from sourcemap or inline comments
    const lines = this.bundleContent.split('\n');

    let currentModule: Partial<ModuleData> | null = null;
    let currentSize = 0;

    for (const line of lines) {
      // Look for module markers
      if (line.includes('__d(') || line.includes('__r(')) {
        if (currentModule && currentModule.path) {
          modules.push({
            id: currentModule.id || modules.length,
            path: currentModule.path,
            size: currentSize,
          });
        }

        currentModule = { id: modules.length };
        currentSize = 0;
      }

      // Extract module path from comments
      const pathMatch = line.match(/\/\*\s*([^*]+)\s*\*\//);
      if (pathMatch && currentModule) {
        currentModule.path = pathMatch[1];
      }

      currentSize += new TextEncoder().encode(line).length;
    }

    // Add the last module
    if (currentModule && currentModule.path) {
      modules.push({
        id: currentModule.id || modules.length,
        path: currentModule.path,
        size: currentSize,
      });
    }
  }

  /**
   * Extract package name from module path
   */
  static extractPackageName(modulePath: string): string | undefined {
    const nodeModulesMatch = modulePath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
    if (nodeModulesMatch) {
      return nodeModulesMatch[1];
    }
    return undefined;
  }

  /**
   * Determine if module is from user code, node_modules, or react-native
   */
  static categorizeModule(modulePath: string): 'user' | 'node_modules' | 'react-native' {
    if (modulePath.includes('node_modules/react-native/')) {
      return 'react-native';
    }
    if (modulePath.includes('node_modules/')) {
      return 'node_modules';
    }
    return 'user';
  }

  /**
   * Get total bundle size
   */
  getTotalSize(): number {
    return new TextEncoder().encode(this.bundleContent).length;
  }
}
