import { BundleAnalysis, OptimizationSuggestion, PackageInfo } from '../types';

interface OptimizationRule {
  packageName: string;
  alternative: string;
  reason: string;
  estimatedSavings: number; // percentage
}

export class OptimizationEngine {
  private static OPTIMIZATION_RULES: OptimizationRule[] = [
    {
      packageName: 'lodash',
      alternative: 'lodash-es',
      reason: 'Use lodash-es for better tree-shaking. Also consider individual lodash packages or native JS methods',
      estimatedSavings: 70,
    },
    {
      packageName: 'moment',
      alternative: 'date-fns or dayjs',
      reason: 'moment.js is 2.9MB. date-fns (13KB per function) or dayjs (2KB) are much smaller alternatives',
      estimatedSavings: 85,
    },
    {
      packageName: 'axios',
      alternative: 'fetch API or ky',
      reason: 'axios is 135KB. Native fetch API is built-in, or use ky (5KB) for similar features',
      estimatedSavings: 50,
    },
    {
      packageName: 'uuid',
      alternative: 'nanoid',
      reason: 'uuid is 22KB. nanoid is 4.5x smaller (108 bytes) and 60% faster',
      estimatedSavings: 60,
    },
    {
      packageName: 'react-native-uuid',
      alternative: 'nanoid',
      reason: 'react-native-uuid is 50KB. nanoid is tiny (108 bytes) and works great in React Native',
      estimatedSavings: 60,
    },
    {
      packageName: 'lodash.throttle',
      alternative: 'lodash-es',
      reason: 'Use lodash-es and import only what you need for better tree-shaking',
      estimatedSavings: 70,
    },
    {
      packageName: 'lodash.debounce',
      alternative: 'lodash-es',
      reason: 'Use lodash-es and import only what you need for better tree-shaking',
      estimatedSavings: 70,
    },
    {
      packageName: 'lodash.get',
      alternative: 'lodash-es or optional chaining',
      reason: 'Use lodash-es for tree-shaking or native optional chaining (?.) syntax',
      estimatedSavings: 70,
    },
    {
      packageName: 'ramda',
      alternative: 'rambda',
      reason: 'ramda is 445KB. rambda is 96% faster and only 13KB with same API',
      estimatedSavings: 75,
    },
    {
      packageName: 'classnames',
      alternative: 'clsx',
      reason: 'classnames is 2.5KB. clsx is 200 bytes and faster',
      estimatedSavings: 40,
    },
    {
      packageName: 'react-native-vector-icons',
      alternative: 'individual icon SVG imports',
      reason: 'react-native-vector-icons bundles all icons. Use react-native-svg with specific icons',
      estimatedSavings: 80,
    },
    {
      packageName: '@expo/vector-icons',
      alternative: 'individual icon SVG imports',
      reason: '@expo/vector-icons includes all icon sets. Import only needed icons as SVG',
      estimatedSavings: 80,
    },
    {
      packageName: 'validator',
      alternative: 'yup or zod',
      reason: 'validator is 150KB. yup (37KB) or zod (53KB) are smaller with better TypeScript support',
      estimatedSavings: 50,
    },
    {
      packageName: 'query-string',
      alternative: 'URLSearchParams',
      reason: 'query-string is 17KB. Native URLSearchParams API is built-in',
      estimatedSavings: 100,
    },
    {
      packageName: 'qs',
      alternative: 'URLSearchParams or fast-querystring',
      reason: 'qs is 27KB. URLSearchParams is native or use fast-querystring (8KB)',
      estimatedSavings: 60,
    },
  ];

  private static LARGE_PACKAGE_THRESHOLD = 100 * 1024; // 100KB
  private static DUPLICATE_THRESHOLD = 50 * 1024; // 50KB

  static generateOptimizations(analysis: BundleAnalysis): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for packages with known better alternatives
    suggestions.push(...this.checkKnownReplacements(analysis.packages));

    // Check for large packages
    suggestions.push(...this.checkLargePackages(analysis.packages));

    // Check for duplicates
    suggestions.push(...this.checkDuplicates(analysis));

    // Check for unused heavy packages
    suggestions.push(...this.checkUnusedCode(analysis.packages));

    // Sort by potential savings
    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  private static checkKnownReplacements(packages: PackageInfo[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    packages.forEach((pkg) => {
      const rule = this.OPTIMIZATION_RULES.find((r) =>
        pkg.name.toLowerCase().includes(r.packageName.toLowerCase())
      );

      if (rule) {
        const potentialSavings = Math.floor((pkg.size * rule.estimatedSavings) / 100);

        suggestions.push({
          type: 'replace',
          severity: potentialSavings > 200 * 1024 ? 'high' : 'medium',
          package: pkg.name,
          currentSize: pkg.size,
          potentialSavings,
          suggestion: `Replace ${pkg.name} with ${rule.alternative}\n   💡 ${rule.reason}`,
          alternative: rule.alternative,
        });
      }
    });

    return suggestions;
  }

  private static checkLargePackages(packages: PackageInfo[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Packages that should NOT be lazy loaded (essential/core packages)
    const essentialPackages = [
      'react',
      'react-native',
      '@react-native',
      '@sentry/core',
      '@sentry/react-native',
      'react-native-safe-area-context',
      'react-native-screens',
      '@react-navigation/native',
      '@react-navigation/stack',
      '@react-navigation/bottom-tabs',
    ];

    const largePackages = packages.filter((pkg) => pkg.size > this.LARGE_PACKAGE_THRESHOLD);

    largePackages.forEach((pkg) => {
      // Skip essential packages that can't be lazy loaded
      const isEssential = essentialPackages.some((essential) =>
        pkg.name.toLowerCase().includes(essential.toLowerCase())
      );

      if (isEssential) {
        return; // Skip lazy loading suggestion for essential packages
      }

      // Suggest dynamic imports for large non-essential packages
      if (pkg.size > 200 * 1024) {
        suggestions.push({
          type: 'dynamic-import',
          severity: pkg.size > 500 * 1024 ? 'high' : 'medium',
          package: pkg.name,
          currentSize: pkg.size,
          potentialSavings: pkg.size, // Full savings if lazy loaded
          suggestion: `Consider lazy loading ${pkg.name} with dynamic imports\n   💡 Load this package only when needed to reduce initial bundle size`,
        });
      }
    });

    return suggestions;
  }

  private static checkDuplicates(analysis: BundleAnalysis): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    analysis.duplicates.forEach((duplicate) => {
      if (duplicate.totalWaste > this.DUPLICATE_THRESHOLD) {
        suggestions.push({
          type: 'dedupe',
          severity: duplicate.totalWaste > 200 * 1024 ? 'high' : 'medium',
          package: duplicate.name,
          currentSize: duplicate.totalWaste,
          potentialSavings: Math.floor(duplicate.totalWaste * 0.5), // Estimate 50% savings
          suggestion: `Deduplicate ${duplicate.name} - found ${duplicate.versions.length} versions`,
        });
      }
    });

    return suggestions;
  }

  private static checkUnusedCode(packages: PackageInfo[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for packages that are commonly over-imported
    const heavyIconLibraries = packages.filter(
      (pkg) =>
        pkg.name.includes('icons') ||
        pkg.name.includes('fontawesome') ||
        pkg.name === '@expo/vector-icons'
    );

    heavyIconLibraries.forEach((pkg) => {
      if (pkg.size > 100 * 1024) {
        suggestions.push({
          type: 'remove',
          severity: 'medium',
          package: pkg.name,
          currentSize: pkg.size,
          potentialSavings: Math.floor(pkg.size * 0.7),
          suggestion: `Import only needed icons from ${pkg.name} instead of the entire library`,
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate a summary of all optimizations
   */
  static getOptimizationSummary(suggestions: OptimizationSuggestion[]): {
    totalSavings: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  } {
    const totalSavings = suggestions.reduce((sum, s) => sum + s.potentialSavings, 0);
    const highPriority = suggestions.filter((s) => s.severity === 'high').length;
    const mediumPriority = suggestions.filter((s) => s.severity === 'medium').length;
    const lowPriority = suggestions.filter((s) => s.severity === 'low').length;

    return {
      totalSavings,
      highPriority,
      mediumPriority,
      lowPriority,
    };
  }
}
