#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { BundleParser } from './analyzer/bundleParser';
import { DependencyAnalyzer } from './analyzer/dependencyAnalyzer';
import { OptimizationEngine } from './analyzer/optimizationEngine';
import { DeadCodeAnalyzer } from './analyzer/deadCodeAnalyzer';
import { TreeShakeAnalyzer } from './analyzer/treeShakeAnalyzer';
import { Reporter } from './cli/reporter';
import { findBundleFile, readBundleFile, writeJsonFile } from './utils/fileHelper';
import { SourcemapParser } from './utils/sourcemapParser';
import { startServer } from './server';
import { AnalyzerConfig } from './types';

const program = new Command();

program
  .name('react-native-bundle-analyzer')
  .description('Analyze and visualize your React Native bundle')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze the React Native bundle')
  .option('-b, --bundle <path>', 'Path to the bundle file')
  .option('-s, --sourcemap <path>', 'Path to the sourcemap file (auto-detected if not provided)')
  .option('-p, --platform <platform>', 'Platform: ios or android', 'ios')
  .option('--dev', 'Development bundle', false)
  .option('-o, --output <path>', 'Output directory for reports', '.rn-bundle-analyzer')
  .option('--json', 'Output JSON report', false)
  .option('--open', 'Open interactive visualization', false)
  .option('--port <port>', 'Port for the visualization server', '8888')
  .action(async (options) => {
    try {
      const config: AnalyzerConfig = {
        bundlePath: options.bundle,
        sourcemapPath: options.sourcemap,
        platform: options.platform,
        dev: options.dev,
        outputDir: options.output,
        port: parseInt(options.port, 10),
        openBrowser: options.open,
      };

      await analyzeBundle(config, options.json);
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Start the visualization server')
  .option('-p, --port <port>', 'Port for the server', '8888')
  .option('-d, --data <path>', 'Path to analysis data file')
  .action(async (options) => {
    try {
      const dataPath =
        options.data || path.join(process.cwd(), '.rn-bundle-analyzer', 'analysis.json');
      await startServer(parseInt(options.port, 10), dataPath, true);
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

async function analyzeBundle(config: AnalyzerConfig, outputJson: boolean): Promise<void> {
  Reporter.printLoading('Analyzing bundle');

  // Find bundle file
  let bundlePath = config.bundlePath;
  if (!bundlePath) {
    const foundPath = findBundleFile(config.platform, config.dev);
    if (!foundPath) {
      throw new Error(
        `Could not find bundle file. Please specify the path with --bundle option.\n` +
          `Or generate a bundle first:\n` +
          `  npx react-native bundle --platform ${config.platform} --dev false --entry-file index.js --bundle-output ./index.${config.platform}.bundle`
      );
    }
    bundlePath = foundPath;
  }

  Reporter.printSuccess(`Found bundle: ${bundlePath}`);

  // Try to find and load sourcemap
  let sourcemapParser: SourcemapParser | undefined;
  let sourcemapPath = config.sourcemapPath;

  if (!sourcemapPath) {
    const foundSourcemap = SourcemapParser.findSourcemap(bundlePath);
    if (foundSourcemap) {
      sourcemapPath = foundSourcemap;
    }
  }

  if (sourcemapPath && fs.existsSync(sourcemapPath)) {
    Reporter.printLoading('Loading sourcemap');
    try {
      sourcemapParser = new SourcemapParser(sourcemapPath);
      sourcemapParser.load();
      Reporter.printSuccess(`Loaded sourcemap: ${sourcemapPath}`);
    } catch (error) {
      Reporter.printError(`Failed to load sourcemap: ${(error as Error).message}`);
    }
  } else if (!sourcemapPath) {
    console.log(chalk.yellow('\n⚠️  No sourcemap found. Package detection will be limited.'));
    console.log(chalk.gray('   Generate bundle with sourcemap for detailed analysis:'));
    console.log(chalk.gray('   npx react-native bundle ... --sourcemap-output bundle.map\n'));
  }

  // Parse bundle
  Reporter.printLoading('Parsing bundle');
  const bundleContent = readBundleFile(bundlePath);
  const parser = new BundleParser(bundleContent, sourcemapParser);
  const modules = parser.parse();

  Reporter.printSuccess(`Parsed ${modules.length} modules`);

  // Get project root
  const projectRoot = process.cwd();

  // Analyze dependencies
  Reporter.printLoading('Analyzing dependencies');
  const analyzer = new DependencyAnalyzer(modules);
  const analysis = analyzer.analyze();

  // Add project name from package.json
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      analysis.projectName = packageJson.name || 'Unknown Project';
    }
  } catch (error) {
    // Ignore if can't read package.json
  }

  // Generate optimizations
  analysis.optimizations = OptimizationEngine.generateOptimizations(analysis);

  // Analyze dead code
  Reporter.printLoading('Detecting unused code');
  const modulePaths = modules.map(m => m.path);
  const deadCodeAnalyzer = new DeadCodeAnalyzer(projectRoot, modulePaths);
  analysis.deadCode = await deadCodeAnalyzer.analyze();
  Reporter.printSuccess(`Found ${analysis.deadCode.unusedFiles.length} unused files, ${analysis.deadCode.unusedDependencies.length} unused dependencies`);

  // Analyze tree-shaking
  Reporter.printLoading('Analyzing tree-shaking');
  const treeShakeAnalyzer = new TreeShakeAnalyzer(projectRoot);
  analysis.treeShake = await treeShakeAnalyzer.analyze();
  Reporter.printSuccess(`Tree-shaking score: ${analysis.treeShake.score.score}/100`);

  Reporter.printSuccess('Analysis complete');

  // Print report
  Reporter.printReport(analysis);

  // Save JSON report
  if (outputJson || config.openBrowser) {
    const outputDir = config.outputDir || '.rn-bundle-analyzer';
    const jsonPath = path.join(outputDir, 'analysis.json');

    // Convert Map to array for JSON serialization
    const serializableAnalysis = {
      ...analysis,
      moduleMap: Array.from(analysis.moduleMap.entries()),
    };

    writeJsonFile(jsonPath, serializableAnalysis);
    Reporter.printSuccess(`Report saved to ${jsonPath}`);
  }

  // Start visualization server
  if (config.openBrowser) {
    const dataPath = path.join(config.outputDir || '.rn-bundle-analyzer', 'analysis.json');
    await startServer(config.port || 8888, dataPath, true);
  }
}

// Default command
if (process.argv.length === 2) {
  analyzeBundle({ platform: 'ios', dev: false }, false).catch((error) => {
    Reporter.printError(error.message);
    process.exit(1);
  });
} else {
  program.parse();
}
