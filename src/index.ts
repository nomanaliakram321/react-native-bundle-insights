// Main entry point for programmatic usage
export { BundleParser } from './analyzer/bundleParser';
export { DependencyAnalyzer } from './analyzer/dependencyAnalyzer';
export { OptimizationEngine } from './analyzer/optimizationEngine';
export { Reporter } from './cli/reporter';
export { startServer } from './server';
export * from './types';
export { formatBytes, findBundleFile, readBundleFile } from './utils/fileHelper';
export { ReportGenerator } from './utils/reportGenerator';

import { BundleParser } from './analyzer/bundleParser';
import { DependencyAnalyzer } from './analyzer/dependencyAnalyzer';
import { OptimizationEngine } from './analyzer/optimizationEngine';
import { readBundleFile } from './utils/fileHelper';
import { BundleAnalysis } from './types';

/**
 * Analyze a React Native bundle
 * @param bundlePath - Path to the bundle file
 * @returns Bundle analysis data
 */
export async function analyzeBundle(bundlePath: string): Promise<BundleAnalysis> {
  const bundleContent = readBundleFile(bundlePath);
  const parser = new BundleParser(bundleContent);
  const modules = parser.parse();

  const analyzer = new DependencyAnalyzer(modules);
  const analysis = analyzer.analyze();

  analysis.optimizations = OptimizationEngine.generateOptimizations(analysis);

  return analysis;
}
