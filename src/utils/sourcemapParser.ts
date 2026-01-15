import * as fs from 'fs';
import * as path from 'path';

export interface SourceMapData {
  version: number;
  sources: string[];
  names?: string[];
  mappings?: string;
}

export class SourcemapParser {
  private sourcemapPath: string;
  private sourcemapData: SourceMapData | null = null;

  constructor(sourcemapPath: string) {
    this.sourcemapPath = sourcemapPath;
  }

  /**
   * Load and parse the sourcemap file
   */
  load(): void {
    try {
      const content = fs.readFileSync(this.sourcemapPath, 'utf-8');
      this.sourcemapData = JSON.parse(content);
    } catch (error) {
      console.error('Error loading sourcemap:', error);
      throw new Error(`Failed to load sourcemap: ${this.sourcemapPath}`);
    }
  }

  /**
   * Get module path by index
   */
  getModulePath(index: number): string | undefined {
    if (!this.sourcemapData || !this.sourcemapData.sources) {
      return undefined;
    }

    return this.sourcemapData.sources[index];
  }

  /**
   * Get all module paths
   */
  getAllModulePaths(): string[] {
    if (!this.sourcemapData || !this.sourcemapData.sources) {
      return [];
    }

    return this.sourcemapData.sources;
  }

  /**
   * Get total number of modules in sourcemap
   */
  getModuleCount(): number {
    if (!this.sourcemapData || !this.sourcemapData.sources) {
      return 0;
    }

    return this.sourcemapData.sources.length;
  }

  /**
   * Check if sourcemap is loaded
   */
  isLoaded(): boolean {
    return this.sourcemapData !== null;
  }

  /**
   * Auto-detect sourcemap file from bundle path
   */
  static findSourcemap(bundlePath: string): string | null {
    // Try common sourcemap patterns
    const possiblePaths = [
      bundlePath + '.map',
      bundlePath.replace(/\.bundle$/, '.bundle.map'),
      bundlePath.replace(/\.jsbundle$/, '.jsbundle.map'),
    ];

    for (const mapPath of possiblePaths) {
      if (fs.existsSync(mapPath)) {
        // Validate that it's actually a sourcemap file
        try {
          const content = fs.readFileSync(mapPath, 'utf-8');
          // Check if it's valid JSON and has sourcemap structure
          const data = JSON.parse(content);
          if (data.version && data.sources) {
            return mapPath;
          }
        } catch (error) {
          // Not a valid sourcemap, continue to next possibility
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Normalize module path for analysis
   * Converts absolute paths to relative and cleans them up
   */
  static normalizeModulePath(modulePath: string): string {
    // Remove absolute path prefix
    // Example: /Users/name/project/node_modules/react -> node_modules/react
    const nodeModulesIndex = modulePath.indexOf('node_modules/');
    if (nodeModulesIndex !== -1) {
      return modulePath.substring(nodeModulesIndex);
    }

    // For source files, try to extract relative path
    const srcIndex = modulePath.indexOf('/src/');
    if (srcIndex !== -1) {
      return modulePath.substring(srcIndex + 1); // Keep 'src/'
    }

    // Look for common project markers
    const markers = ['/app/', '/components/', '/screens/', '/utils/'];
    for (const marker of markers) {
      const index = modulePath.indexOf(marker);
      if (index !== -1) {
        return modulePath.substring(index + 1);
      }
    }

    // If it's just a filename, return as-is
    if (!modulePath.includes('/') || modulePath.startsWith('./')) {
      return modulePath;
    }

    // Return just the filename for absolute paths we can't normalize
    return path.basename(modulePath);
  }
}
