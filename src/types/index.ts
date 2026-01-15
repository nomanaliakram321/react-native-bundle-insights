export interface ModuleData {
  id: number | string;
  path: string;
  size: number;
  package?: string;
}

export interface PackageInfo {
  name: string;
  size: number;
  percentage: number;
  modules: ModuleData[];
  version?: string;
}

export interface BundleAnalysis {
  projectName?: string;
  totalSize: number;
  yourCodeSize: number;
  nodeModulesSize: number;
  reactNativeSize: number;
  packages: PackageInfo[];
  duplicates: DuplicatePackage[];
  optimizations: OptimizationSuggestion[];
  moduleMap: Map<string, ModuleData>;
  deadCode?: DeadCodeAnalysis;
  treeShake?: TreeShakeAnalysis;
}

export interface DeadCodeAnalysis {
  unusedFiles: UnusedFile[];
  unusedDependencies: UnusedDependency[];
  unusedExports: UnusedExport[];
  totalSavings: number;
}

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

export interface TreeShakeAnalysis {
  score: TreeShakeScore;
  issues: TreeShakeIssue[];
  sideEffects: SideEffect[];
  recommendations: string[];
  estimatedImprovement: number;
}

export interface TreeShakeScore {
  score: number;
  usesESModules: boolean;
  hasNamedExports: boolean;
  hasDefaultExport: boolean;
  hasSideEffects: boolean;
  packageJsonConfigured: boolean;
}

export interface TreeShakeIssue {
  file: string;
  issue: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
}

export interface SideEffect {
  file: string;
  line: number;
  code: string;
  type: 'console' | 'global-mutation' | 'require-side-effect' | 'top-level-call';
  severity: 'error' | 'warning';
}

export interface DuplicatePackage {
  name: string;
  versions: string[];
  totalWaste: number;
  paths: string[];
}

export interface OptimizationSuggestion {
  type: 'replace' | 'remove' | 'dedupe' | 'dynamic-import';
  severity: 'high' | 'medium' | 'low';
  package: string;
  currentSize: number;
  potentialSavings: number;
  suggestion: string;
  alternative?: string;
}

export interface AnalyzerConfig {
  bundlePath?: string;
  sourcemapPath?: string;
  platform?: 'ios' | 'android';
  dev?: boolean;
  outputDir?: string;
  port?: number;
  openBrowser?: boolean;
}

export interface TreemapNode {
  name: string;
  value: number;
  children?: TreemapNode[];
  path?: string;
  percentage?: number;
}
