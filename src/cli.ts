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
  .name('react-native-bundle-insights')
  .description('Analyze and visualize your React Native bundle')
  .version('1.0.9');

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

program
  .command('source-analyze')
  .description('Analyze source code for unused dependencies and files (accurate)')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('--json', 'Output JSON format', false)
  .option('--open', 'Open web visualization', false)
  .option('--port <port>', 'Port for visualization server', '8889')
  .action(async (options) => {
    try {
      const { SourceCodeAnalyzer } = await import('./analyzer/sourceCodeAnalyzer');
      const projectRoot = path.resolve(options.project);

      Reporter.printLoading('Analyzing source code');
      const analyzer = new SourceCodeAnalyzer(projectRoot);
      const result = analyzer.analyze();

      // Save results if opening web view
      if (options.open) {
        const outputDir = path.join(projectRoot, '.rn-bundle-analyzer');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const jsonPath = path.join(outputDir, 'source-analysis.json');
        const jsonResult = {
          ...result,
          importedFiles: Array.from(result.importedFiles),
        };
        fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));

        // Start server
        await startSourceAnalysisServer(parseInt(options.port, 10), jsonPath, true);
        return;
      }

      if (options.json) {
        // Convert Set to array for JSON serialization
        const jsonResult = {
          ...result,
          importedFiles: Array.from(result.importedFiles),
        };
        console.log(JSON.stringify(jsonResult, null, 2));
      } else {
        // Print Step 1: Detailed Dependency Usage
        console.log(chalk.bold('\n📊 STEP 1: Dependency Usage Analysis\n'));
        console.log(chalk.gray(`Total Dependencies: ${result.totalDependencies}`));
        console.log(chalk.gray(`Total Project Files: ${result.totalProjectFiles}\n`));

        // Show top 20 most used dependencies
        const Table = require('cli-table3');
        const table = new Table({
          head: [chalk.cyan('Dependency'), chalk.cyan('Usage'), chalk.cyan('Files'), chalk.cyan('%')],
          colWidths: [40, 10, 10, 10],
        });

        result.dependencyUsages.slice(0, 20).forEach((dep: any) => {
          if (dep.isUsed) {
            table.push([
              dep.name,
              dep.usageCount,
              dep.filesUsing.length,
              `${dep.usagePercentage.toFixed(1)}%`,
            ]);
          }
        });

        console.log(table.toString());

        // Print formatted report
        console.log(chalk.bold('\n✅ Used Dependencies\n'));
        console.log(chalk.gray(`Found ${result.usedDependencies.length} dependencies in use\n`));

        if (result.unusedDependencies.length > 0) {
          console.log(chalk.bold('\n⚠️  Unused Dependencies\n'));
          console.log(chalk.yellow(`Found ${result.unusedDependencies.length} dependencies that are NOT imported:\n`));
          result.unusedDependencies.forEach((dep: string) => {
            console.log(chalk.yellow(`  - ${dep}`));
          });

          console.log(chalk.bold('\n💡 To remove unused dependencies:\n'));
          console.log(chalk.gray('yarn remove ') + chalk.yellow(result.unusedDependencies.join(' ')));
        } else {
          console.log(chalk.bold('\n✅ No Unused Dependencies\n'));
        }

        if (result.unusedFiles.length > 0) {
          console.log(chalk.bold(`\n📁 Potentially Unused Files (${result.unusedFiles.length})\n`));
          console.log(chalk.gray('Run with --json to see full list\n'));
        }

        // NEW: Print unused imports
        if (result.unusedImports && result.unusedImports.length > 0) {
          console.log(chalk.bold(`\n🔍 Unused Imports (${result.unusedImports.length})\n`));
          console.log(chalk.yellow('These imports are not used in their respective files:\n'));

          // Group by file
          const byFile: { [file: string]: typeof result.unusedImports } = {};
          result.unusedImports.forEach(imp => {
            if (!byFile[imp.file]) byFile[imp.file] = [];
            byFile[imp.file].push(imp);
          });

          Object.entries(byFile).slice(0, 10).forEach(([file, imports]) => {
            console.log(chalk.cyan(`  ${file}`));
            imports.forEach(imp => {
              console.log(chalk.gray(`    Line ${imp.line}: `) + chalk.yellow(imp.importName));
            });
          });

          if (Object.keys(byFile).length > 10) {
            console.log(chalk.gray(`\n  ... and ${Object.keys(byFile).length - 10} more files`));
          }

          console.log(chalk.bold('\n💡 Run with --open to see interactive view\n'));
        }
      }
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('bundle-treemap')
  .description('Visualize bundle size with interactive treemap')
  .option('-b, --bundle <path>', 'Path to the bundle file')
  .option('-s, --sourcemap <path>', 'Path to the sourcemap file (auto-detected if not provided)')
  .option('-p, --platform <platform>', 'Platform: ios or android', 'ios')
  .option('--dev', 'Development bundle', false)
  .option('--open', 'Open web visualization', true)
  .option('--port <port>', 'Port for visualization server', '8891')
  .action(async (options) => {
    try {
      const config: AnalyzerConfig = {
        bundlePath: options.bundle,
        sourcemapPath: options.sourcemap,
        platform: options.platform,
        dev: options.dev,
        outputDir: '.rn-bundle-analyzer',
        port: parseInt(options.port, 10),
        openBrowser: options.open,
      };

      // Run bundle analysis
      await analyzeBundleForTreemap(config);
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('unused-code')
  .description('Detect and visualize unused files in your codebase')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('--open', 'Open web visualization', true)
  .option('--port <port>', 'Port for visualization server', '8892')
  .action(async (options) => {
    try {
      const { SourceCodeAnalyzer } = await import('./analyzer/sourceCodeAnalyzer');
      const projectRoot = path.resolve(options.project);

      Reporter.printLoading('Analyzing source code for unused files');
      const analyzer = new SourceCodeAnalyzer(projectRoot);
      const result = analyzer.analyze();

      Reporter.printSuccess(`Found ${result.unusedFiles.length} unused files`);

      // Save results
      const outputDir = path.join(projectRoot, '.rn-bundle-analyzer');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const jsonPath = path.join(outputDir, 'source-analysis.json');
      const jsonResult = {
        ...result,
        importedFiles: Array.from(result.importedFiles),
      };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));

      if (options.open) {
        await startUnusedCodeServer(parseInt(options.port, 10), jsonPath, true);
      }
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('security')
  .description('Scan for hardcoded secrets, PII, and security vulnerabilities')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('--open', 'Open web visualization', true)
  .option('--port <port>', 'Port for visualization server', '8894')
  .action(async (options) => {
    try {
      const { SensitiveDataAnalyzer } = await import('./analyzer/sensitiveDataAnalyzer');
      const projectRoot = path.resolve(options.project);

      Reporter.printLoading('Scanning for security issues');
      const analyzer = new SensitiveDataAnalyzer(projectRoot);
      const result = await analyzer.analyze();

      // Print summary
      console.log(chalk.bold('\n🔒 Security Analysis Results\n'));
      console.log(chalk.gray(`Files Scanned: ${result.filesScanned}`));
      console.log(chalk.gray(`Total Issues: ${result.totalIssues}\n`));

      if (result.criticalIssues > 0) {
        console.log(chalk.red(`⚠️  Critical Issues: ${result.criticalIssues}`));
      }
      if (result.highIssues > 0) {
        console.log(chalk.yellow(`⚠️  High Severity: ${result.highIssues}`));
      }
      if (result.mediumIssues > 0) {
        console.log(chalk.blue(`ℹ️  Medium Severity: ${result.mediumIssues}`));
      }
      if (result.lowIssues > 0) {
        console.log(chalk.gray(`ℹ️  Low Severity: ${result.lowIssues}`));
      }

      if (result.totalIssues === 0) {
        console.log(chalk.green('\n✅ No security issues found!\n'));
      } else {
        console.log(chalk.bold('\n💡 Run with --open to see detailed interactive report\n'));
      }

      // Save results
      const outputDir = path.join(projectRoot, '.rn-bundle-analyzer');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const jsonPath = path.join(outputDir, 'security-analysis.json');
      analyzer.saveReport(jsonPath, result);

      if (options.open) {
        await startSecurityServer(parseInt(options.port, 10), jsonPath, true);
      }
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('assets')
  .description('Analyze images and assets for optimization opportunities')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('--open', 'Open web visualization', true)
  .option('--port <port>', 'Port for visualization server', '8895')
  .action(async (options) => {
    try {
      const { AssetAnalyzer } = await import('./analyzer/assetAnalyzer');
      const projectRoot = path.resolve(options.project);

      Reporter.printLoading('Scanning assets');
      const analyzer = new AssetAnalyzer(projectRoot);
      const result = await analyzer.analyze();

      // Helper function for formatting bytes
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      // Print summary
      console.log(chalk.bold('\n🖼️  Asset Analysis Results\n'));
      console.log(chalk.gray(`Total Assets: ${result.totalAssets}`));
      console.log(chalk.gray(`Total Size: ${formatBytes(result.totalSize)}`));
      console.log(chalk.gray(`Images: ${result.imageCount} (${formatBytes(result.imageSize)})\n`));

      if (result.largeImages.length > 0) {
        console.log(chalk.yellow(`⚠️  Large Images: ${result.largeImages.length}`));
      }
      if (result.unoptimizedImages.length > 0) {
        console.log(chalk.blue(`📦 Unoptimized Formats: ${result.unoptimizedImages.length}`));
      }
      if (result.duplicateAssets.length > 0) {
        console.log(chalk.red(`🔄 Duplicate Assets: ${result.duplicateAssets.length}`));
      }
      if (result.unusedAssets.length > 0) {
        console.log(chalk.gray(`🗑️  Unused Assets: ${result.unusedAssets.length}`));
      }

      if (result.recommendations.potentialSavings > 0) {
        console.log(chalk.bold(`\n💰 Potential Savings: ${formatBytes(result.recommendations.potentialSavings)}`));
        if (result.recommendations.webpConversion > 0) {
          console.log(chalk.gray(`   • WebP conversion: ~${formatBytes(result.recommendations.webpConversion)}`));
        }
        if (result.recommendations.duplicateRemoval > 0) {
          console.log(chalk.gray(`   • Duplicate removal: ${formatBytes(result.recommendations.duplicateRemoval)}`));
        }
        if (result.recommendations.compressionSavings > 0) {
          console.log(chalk.gray(`   • Compression: ~${formatBytes(result.recommendations.compressionSavings)}`));
        }
      }

      console.log(chalk.bold('\n💡 Run with --open to see detailed interactive report\n'));

      // Save results
      const outputDir = path.join(projectRoot, '.rn-bundle-analyzer');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const jsonPath = path.join(outputDir, 'asset-analysis.json');
      analyzer.saveReport(jsonPath, result);

      if (options.open) {
        await startAssetServer(parseInt(options.port, 10), jsonPath, true);
      }
    } catch (error) {
      Reporter.printError((error as Error).message);
      process.exit(1);
    }
  });

program
  .command('all')
  .description('Run all analyses and open unified dashboard')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('-b, --bundle <path>', 'Path to the bundle file (optional)')
  .option('-s, --sourcemap <path>', 'Path to the sourcemap file (optional)')
  .option('--platform <platform>', 'Platform: ios or android', 'ios')
  .option('--port <port>', 'Port for unified dashboard server', '8893')
  .action(async (options) => {
    try {
      const projectRoot = path.resolve(options.project);
      const outputDir = path.join(projectRoot, '.rn-bundle-analyzer');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(chalk.bold.cyan('\n📊 React Native Bundle Insights - Complete Analysis\n'));
      console.log(chalk.gray('Running all analyses...\n'));

      // 1. Bundle Treemap Analysis
      try {
        const config: AnalyzerConfig = {
          bundlePath: options.bundle,
          sourcemapPath: options.sourcemap,
          platform: options.platform,
          dev: false,
          outputDir,
          port: parseInt(options.port, 10),
          openBrowser: false,
        };
        await analyzeBundleForTreemap(config);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Bundle analysis skipped: ${(error as Error).message}\n`));
      }

      // 2. Source Code Analysis (unused code)
      try {
        const { SourceCodeAnalyzer } = await import('./analyzer/sourceCodeAnalyzer');
        Reporter.printLoading('Analyzing source code');
        const sourceAnalyzer = new SourceCodeAnalyzer(projectRoot);
        const sourceResult = sourceAnalyzer.analyze();

        // Add project name from package.json
        let projectName = 'Unknown Project';
        try {
          const packageJsonPath = path.join(projectRoot, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            projectName = packageJson.name || 'Unknown Project';
          }
        } catch (error) {
          // Ignore if can't read package.json
        }

        const jsonPath = path.join(outputDir, 'source-analysis.json');
        const jsonResult = {
          ...sourceResult,
          importedFiles: Array.from(sourceResult.importedFiles),
          projectName,
        };
        fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));
        Reporter.printSuccess(`Found ${sourceResult.unusedFiles.length} unused files, ${sourceResult.unusedImports.length} unused imports`);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Source analysis failed: ${(error as Error).message}\n`));
      }

      // 3. Security Analysis
      try {
        const { SensitiveDataAnalyzer } = await import('./analyzer/sensitiveDataAnalyzer');
        Reporter.printLoading('Scanning for security issues');
        const securityAnalyzer = new SensitiveDataAnalyzer(projectRoot);
        const securityResult = await securityAnalyzer.analyze();

        const jsonPath = path.join(outputDir, 'security-analysis.json');
        securityAnalyzer.saveReport(jsonPath, securityResult);
        Reporter.printSuccess(`Security scan complete: ${securityResult.totalIssues} issues found`);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Security analysis failed: ${(error as Error).message}\n`));
      }

      // 4. Asset Analysis
      try {
        const { AssetAnalyzer } = await import('./analyzer/assetAnalyzer');
        Reporter.printLoading('Scanning assets');
        const assetAnalyzer = new AssetAnalyzer(projectRoot);
        const assetResult = await assetAnalyzer.analyze();

        const jsonPath = path.join(outputDir, 'asset-analysis.json');
        assetAnalyzer.saveReport(jsonPath, assetResult);
        Reporter.printSuccess(`Asset scan complete: ${assetResult.totalAssets} assets analyzed`);
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Asset analysis failed: ${(error as Error).message}\n`));
      }

      // Open unified dashboard
      console.log(chalk.bold.green('\n✅ All analyses complete!\n'));
      console.log(chalk.gray('Opening unified dashboard with all tabs...\n'));

      const dataPath = path.join(outputDir, 'source-analysis.json');
      await startUnusedCodeServer(parseInt(options.port, 10), dataPath, true);
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

  // Analyze dead code (disabled by default due to accuracy issues)
  // Reporter.printLoading('Detecting unused code');
  // const modulePaths = modules.map(m => m.path);
  // const deadCodeAnalyzer = new DeadCodeAnalyzer(projectRoot, modulePaths);
  // analysis.deadCode = await deadCodeAnalyzer.analyze();
  // Reporter.printSuccess(`Found ${analysis.deadCode.unusedFiles.length} unused files, ${analysis.deadCode.unusedDependencies.length} unused dependencies`);

  // Analyze tree-shaking (disabled by default)
  // Reporter.printLoading('Analyzing tree-shaking');
  // const treeShakeAnalyzer = new TreeShakeAnalyzer(projectRoot);
  // analysis.treeShake = await treeShakeAnalyzer.analyze();
  // Reporter.printSuccess(`Tree-shaking score: ${analysis.treeShake.score.score}/100`);

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

async function analyzeBundleForTreemap(config: AnalyzerConfig): Promise<void> {
  Reporter.printLoading('Analyzing bundle for treemap');

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

  // Analyze dependencies
  Reporter.printLoading('Analyzing dependencies');
  const analyzer = new DependencyAnalyzer(modules);
  const analysis = analyzer.analyze();

  Reporter.printSuccess('Analysis complete');

  // Save for treemap visualization
  const outputDir = config.outputDir || '.rn-bundle-analyzer';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, 'bundle-analysis.json');
  const serializableAnalysis = {
    ...analysis,
    moduleMap: Array.from(analysis.moduleMap.entries()),
  };

  writeJsonFile(jsonPath, serializableAnalysis);
  Reporter.printSuccess(`Bundle data saved to ${jsonPath}`);

  // Start treemap server
  if (config.openBrowser) {
    await startBundleTreemapServer(config.port || 8891, jsonPath, true);
  }
}

async function startSourceAnalysisServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const express = require('express');
  const app = express();

  // Add CORS headers
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // API ROUTES MUST COME BEFORE static files!
  // Test endpoint
  app.get('/api/test', (req: any, res: any) => {
    res.json({ status: 'Server is working!', dataPath });
  });

  // API endpoint for source analysis data
  app.get('/api/source-analysis', (req: any, res: any) => {
    try {
      console.log('📁 Looking for data at:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.error('❌ File not found:', dataPath);
        return res.status(404).json({ error: `Analysis data not found at: ${dataPath}` });
      }

      console.log('✅ File found, reading...');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      res.status(500).json({
        error: 'Failed to load analysis data',
        details: (error as Error).message,
        path: dataPath
      });
    }
  });

  // Serve root as source-analysis.html (NOT index.html)
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/source-analysis.html'));
  });

  // Serve static files for other assets (CSS, JS, images)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Source Analysis Dashboard running at ${url}`);

    if (shouldOpen) {
      const open = require('open');
      open(url);
    }
  });
}

async function startBundleTreemapServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const express = require('express');
  const app = express();

  // Add CORS headers
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // API ROUTES MUST COME BEFORE static files!
  // Test endpoint
  app.get('/api/test', (req: any, res: any) => {
    res.json({ status: 'Bundle treemap server is working!', dataPath });
  });

  // API endpoint for bundle analysis data
  app.get('/api/bundle-analysis', (req: any, res: any) => {
    try {
      console.log('📁 Looking for bundle data at:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.error('❌ File not found:', dataPath);
        return res.status(404).json({ error: `Bundle analysis data not found at: ${dataPath}` });
      }

      console.log('✅ File found, reading...');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Bundle data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading bundle data:', error);
      res.status(500).json({
        error: 'Failed to load bundle analysis data',
        details: (error as Error).message,
        path: dataPath
      });
    }
  });

  // Serve root as bundle-treemap.html
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/bundle-treemap.html'));
  });

  // Serve static files for other assets (CSS, JS, images)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Bundle Treemap Dashboard running at ${url}`);

    if (shouldOpen) {
      const open = require('open');
      open(url);
    }
  });
}

async function startUnusedCodeServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const express = require('express');
  const app = express();

  // Add CORS headers
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // API ROUTES MUST COME BEFORE static files!
  // Test endpoint
  app.get('/api/test', (req: any, res: any) => {
    res.json({ status: 'Unused code server is working!', dataPath });
  });

  // API endpoint for source analysis (unused imports)
  app.get('/api/source-analysis', (req: any, res: any) => {
    try {
      console.log('📁 Looking for unused code data at:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.error('❌ File not found:', dataPath);
        return res.status(404).json({ error: `Analysis data not found at: ${dataPath}` });
      }

      console.log('✅ File found, reading...');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Unused code data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      res.status(500).json({
        error: 'Failed to load unused code data',
        details: (error as Error).message,
        path: dataPath
      });
    }
  });

  // API endpoint for bundle treemap
  app.get('/api/bundle-analysis', (req: any, res: any) => {
    try {
      const bundleDataPath = dataPath.replace('source-analysis.json', 'bundle-analysis.json');
      console.log('📁 Looking for bundle data at:', bundleDataPath);

      if (!fs.existsSync(bundleDataPath)) {
        console.error('❌ Bundle data not found');
        return res.status(404).json({ error: `Bundle analysis data not found. Run bundle-treemap command first.` });
      }

      console.log('✅ Bundle data found, reading...');
      const data = fs.readFileSync(bundleDataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Bundle data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading bundle data:', error);
      res.status(500).json({
        error: 'Failed to load bundle analysis data',
        details: (error as Error).message,
      });
    }
  });

  // API endpoint for security analysis
  app.get('/api/security-analysis', (req: any, res: any) => {
    try {
      const securityDataPath = dataPath.replace('source-analysis.json', 'security-analysis.json');
      console.log('📁 Looking for security data at:', securityDataPath);

      if (!fs.existsSync(securityDataPath)) {
        console.error('❌ Security data not found');
        return res.status(404).json({ error: `Security analysis data not found. Run security command first.` });
      }

      console.log('✅ Security data found, reading...');
      const data = fs.readFileSync(securityDataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Security data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading security data:', error);
      res.status(500).json({
        error: 'Failed to load security analysis data',
        details: (error as Error).message,
      });
    }
  });

  // API endpoint for asset analysis
  app.get('/api/asset-analysis', (req: any, res: any) => {
    try {
      const assetDataPath = dataPath.replace('source-analysis.json', 'asset-analysis.json');
      console.log('📁 Looking for asset data at:', assetDataPath);

      if (!fs.existsSync(assetDataPath)) {
        console.error('❌ Asset data not found');
        return res.status(404).json({ error: `Asset analysis data not found. Run assets command first.` });
      }

      console.log('✅ Asset data found, reading...');
      const data = fs.readFileSync(assetDataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Asset data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading asset data:', error);
      res.status(500).json({
        error: 'Failed to load asset analysis data',
        details: (error as Error).message,
      });
    }
  });

  // Serve unified dashboard at root
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  });

  // Individual page routes for iframe embedding
  app.get('/bundle-treemap', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/bundle-treemap.html'));
  });

  app.get('/source-analysis', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/source-analysis.html'));
  });

  app.get('/unused-imports', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/unused-code.html'));
  });

  app.get('/security-analysis', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/security-analysis.html'));
  });

  app.get('/asset-analysis', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/asset-analysis.html'));
  });

  // Serve static files for other assets (CSS, JS, images)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Unused Code Dashboard running at ${url}`);

    if (shouldOpen) {
      const open = require('open');
      open(url);
    }
  });
}

async function startSecurityServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const express = require('express');
  const app = express();

  // Add CORS headers
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // API endpoint for security analysis
  app.get('/api/security-analysis', (req: any, res: any) => {
    try {
      console.log('📁 Looking for security data at:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.error('❌ File not found:', dataPath);
        return res.status(404).json({ error: `Security analysis data not found at: ${dataPath}` });
      }

      console.log('✅ File found, reading...');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Security data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading security data:', error);
      res.status(500).json({
        error: 'Failed to load security analysis data',
        details: (error as Error).message,
        path: dataPath
      });
    }
  });

  // Serve root as security-analysis.html
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/security-analysis.html'));
  });

  // Serve static files for other assets (CSS, JS, images)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Security Analysis Dashboard running at ${url}`);

    if (shouldOpen) {
      const open = require('open');
      open(url);
    }
  });
}

async function startAssetServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const express = require('express');
  const app = express();

  // Add CORS headers
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // API endpoint for asset analysis
  app.get('/api/asset-analysis', (req: any, res: any) => {
    try {
      console.log('📁 Looking for asset data at:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.error('❌ File not found:', dataPath);
        return res.status(404).json({ error: `Asset analysis data not found at: ${dataPath}` });
      }

      console.log('✅ File found, reading...');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);
      console.log('✅ Asset data loaded successfully');
      res.json(analysis);
    } catch (error) {
      console.error('❌ Error loading asset data:', error);
      res.status(500).json({
        error: 'Failed to load asset analysis data',
        details: (error as Error).message,
        path: dataPath
      });
    }
  });

  // Serve root as asset-analysis.html
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../public/asset-analysis.html'));
  });

  // Serve static files for other assets (CSS, JS, images)
  app.use(express.static(path.join(__dirname, '../public')));

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Asset Analysis Dashboard running at ${url}`);

    if (shouldOpen) {
      const open = require('open');
      open(url);
    }
  });
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
