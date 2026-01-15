import { ModuleData, PackageInfo, DuplicatePackage, BundleAnalysis } from '../types';
import { BundleParser } from './bundleParser';
import * as fs from 'fs';
import * as path from 'path';

export class DependencyAnalyzer {
  private modules: ModuleData[];

  constructor(modules: ModuleData[]) {
    this.modules = modules;
  }

  /**
   * Analyze all dependencies and create a comprehensive report
   */
  analyze(): BundleAnalysis {
    const packages = this.analyzePackages();
    const duplicates = this.findDuplicates();
    const moduleMap = new Map(this.modules.map((m) => [m.path, m]));

    let yourCodeSize = 0;
    let nodeModulesSize = 0;
    let reactNativeSize = 0;

    this.modules.forEach((module) => {
      const category = BundleParser.categorizeModule(module.path);
      if (category === 'user') {
        yourCodeSize += module.size;
      } else if (category === 'react-native') {
        reactNativeSize += module.size;
      } else {
        nodeModulesSize += module.size;
      }
    });

    const totalSize = yourCodeSize + nodeModulesSize + reactNativeSize;

    return {
      totalSize,
      yourCodeSize,
      nodeModulesSize,
      reactNativeSize,
      packages,
      duplicates,
      optimizations: [],
      moduleMap,
    };
  }

  /**
   * Analyze packages and their sizes
   */
  private analyzePackages(): PackageInfo[] {
    const packageMap = new Map<string, ModuleData[]>();

    // Group modules by package
    this.modules.forEach((module) => {
      const packageName = BundleParser.extractPackageName(module.path);
      if (packageName) {
        if (!packageMap.has(packageName)) {
          packageMap.set(packageName, []);
        }
        packageMap.get(packageName)!.push(module);
      }
    });

    // Calculate package sizes and percentages
    const totalSize = this.modules.reduce((sum, m) => sum + m.size, 0);
    const packages: PackageInfo[] = [];

    packageMap.forEach((modules, packageName) => {
      const size = modules.reduce((sum, m) => sum + m.size, 0);
      const version = this.getPackageVersion(packageName);

      packages.push({
        name: packageName,
        size,
        percentage: (size / totalSize) * 100,
        modules,
        version,
      });
    });

    // Sort by size (largest first)
    return packages.sort((a, b) => b.size - a.size);
  }

  /**
   * Find duplicate packages (different versions of the same package)
   */
  private findDuplicates(): DuplicatePackage[] {
    const duplicates: DuplicatePackage[] = [];
    const packagePaths = new Map<string, Set<string>>();

    this.modules.forEach((module) => {
      const packageName = BundleParser.extractPackageName(module.path);
      if (packageName) {
        if (!packagePaths.has(packageName)) {
          packagePaths.set(packageName, new Set());
        }

        // Extract unique installation paths
        // Look for patterns like: node_modules/pkg or node_modules/other-pkg/node_modules/pkg
        const nodeModulesMatches = module.path.match(/node_modules\/@?[^/]+(?:\/[^/]+)?/g);
        if (nodeModulesMatches) {
          // Get the last occurrence which indicates where this specific package is installed
          const lastMatch = nodeModulesMatches[nodeModulesMatches.length - 1];
          // Extract just the package name part
          const pkgPath = lastMatch.replace(/^node_modules\//, '');
          if (pkgPath.includes(packageName)) {
            // Store the prefix path to detect nested node_modules
            const prefixMatch = module.path.match(/(.*node_modules\/)/);
            if (prefixMatch) {
              packagePaths.get(packageName)!.add(prefixMatch[1] + packageName);
            }
          }
        }
      }
    });

    packagePaths.forEach((paths, packageName) => {
      // Only report as duplicate if we found the same package in different locations
      const uniquePaths = Array.from(paths).filter(p => p && p.trim() !== '');
      if (uniquePaths.length > 1) {
        const modules = this.modules.filter(
          (m) => BundleParser.extractPackageName(m.path) === packageName
        );
        const totalWaste = modules.reduce((sum, m) => sum + m.size, 0);

        // Calculate waste as size divided by number of installations
        const actualWaste = totalWaste / uniquePaths.length * (uniquePaths.length - 1);

        duplicates.push({
          name: packageName,
          versions: uniquePaths,
          totalWaste: actualWaste,
          paths: uniquePaths,
        });
      }
    });

    return duplicates.sort((a, b) => b.totalWaste - a.totalWaste);
  }

  /**
   * Get package version from package.json
   */
  private getPackageVersion(packageName: string): string | undefined {
    try {
      const packageJsonPath = path.join(
        process.cwd(),
        'node_modules',
        packageName,
        'package.json'
      );

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version;
      }
    } catch (error) {
      // Ignore errors
    }
    return undefined;
  }
}
