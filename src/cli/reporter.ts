import chalk from 'chalk';
import Table from 'cli-table3';
import { BundleAnalysis } from '../types';
import { formatBytes } from '../utils/fileHelper';

export class Reporter {
  /**
   * Print a beautiful analysis report to the console
   */
  static printReport(analysis: BundleAnalysis): void {
    console.log('\n');
    this.printHeader();
    this.printSummary(analysis);
    this.printTopPackages(analysis);
    this.printDuplicates(analysis);

    // Print new sections
    if (analysis.deadCode) {
      this.printDeadCode(analysis.deadCode);
    }
    if (analysis.treeShake) {
      this.printTreeShake(analysis.treeShake);
    }

    this.printOptimizations(analysis);
    console.log('\n');
  }

  private static printHeader(): void {
    const header = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        ${chalk.cyan.bold('React Native Bundle Analyzer')}                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `;
    console.log(chalk.cyan(header));
  }

  private static printSummary(analysis: BundleAnalysis): void {
    const totalSize = formatBytes(analysis.totalSize);
    const yourCodePercentage = ((analysis.yourCodeSize / analysis.totalSize) * 100).toFixed(1);
    const nodeModulesPercentage = (
      (analysis.nodeModulesSize / analysis.totalSize) *
      100
    ).toFixed(1);
    const reactNativePercentage = (
      (analysis.reactNativeSize / analysis.totalSize) *
      100
    ).toFixed(1);

    console.log(chalk.bold('\n📦 Bundle Summary\n'));

    const summaryTable = new Table({
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
      style: { head: ['cyan'] },
    });

    summaryTable.push(
      [chalk.bold('Total Bundle Size'), chalk.green.bold(totalSize)],
      [''],
      [
        chalk.cyan('Your Code'),
        `${this.createProgressBar(parseFloat(yourCodePercentage), 30)} ${chalk.yellow(
          yourCodePercentage + '%'
        )} ${chalk.gray('(' + formatBytes(analysis.yourCodeSize) + ')')}`,
      ],
      [
        chalk.cyan('node_modules'),
        `${this.createProgressBar(parseFloat(nodeModulesPercentage), 30)} ${chalk.yellow(
          nodeModulesPercentage + '%'
        )} ${chalk.gray('(' + formatBytes(analysis.nodeModulesSize) + ')')}`,
      ],
      [
        chalk.cyan('React Native'),
        `${this.createProgressBar(parseFloat(reactNativePercentage), 30)} ${chalk.yellow(
          reactNativePercentage + '%'
        )} ${chalk.gray('(' + formatBytes(analysis.reactNativeSize) + ')')}`,
      ]
    );

    console.log(summaryTable.toString());
  }

  private static printTopPackages(analysis: BundleAnalysis): void {
    console.log(chalk.bold('\n📊 Top 10 Dependencies\n'));

    const table = new Table({
      head: [
        chalk.cyan.bold('Package'),
        chalk.cyan.bold('Size'),
        chalk.cyan.bold('% of Bundle'),
        chalk.cyan.bold('Modules'),
      ],
      colWidths: [35, 15, 15, 10],
    });

    const top10 = analysis.packages.slice(0, 10);

    top10.forEach((pkg, index) => {
      const position = chalk.gray(`${index + 1}.`);
      const name = pkg.name + (pkg.version ? chalk.gray(` (${pkg.version})`) : '');
      const size = formatBytes(pkg.size);
      const percentage = pkg.percentage.toFixed(2) + '%';
      const modules = pkg.modules.length.toString();

      table.push([`${position} ${name}`, size, percentage, modules]);
    });

    console.log(table.toString());
  }

  private static printDuplicates(analysis: BundleAnalysis): void {
    if (analysis.duplicates.length === 0) {
      console.log(
        chalk.bold('\n✅ No Duplicate Packages Found\n'),
        chalk.gray('All dependencies are properly deduped.')
      );
      return;
    }

    console.log(chalk.bold('\n⚠️  Duplicate Packages\n'));

    const table = new Table({
      head: [chalk.cyan.bold('Package'), chalk.cyan.bold('Versions'), chalk.cyan.bold('Waste')],
      colWidths: [35, 15, 15],
    });

    analysis.duplicates.forEach((duplicate) => {
      table.push([
        chalk.yellow(duplicate.name),
        duplicate.versions.length.toString(),
        chalk.red(formatBytes(duplicate.totalWaste)),
      ]);
    });

    console.log(table.toString());
  }

  private static printOptimizations(analysis: BundleAnalysis): void {
    if (analysis.optimizations.length === 0) {
      console.log(
        chalk.bold('\n✅ No Optimization Suggestions\n'),
        chalk.gray('Your bundle is well optimized!')
      );
      return;
    }

    console.log(chalk.bold('\n🎯 Optimization Suggestions\n'));

    analysis.optimizations.forEach((opt, index) => {
      const icon = opt.severity === 'high' ? '🔴' : opt.severity === 'medium' ? '🟡' : '🟢';
      const savings = formatBytes(opt.potentialSavings);

      console.log(
        `${icon} ${chalk.bold(opt.suggestion)}\n` +
          `   ${chalk.gray('Package:')} ${opt.package}\n` +
          `   ${chalk.gray('Current size:')} ${formatBytes(opt.currentSize)}\n` +
          `   ${chalk.green('Potential savings:')} ${chalk.green.bold(savings)}\n`
      );
    });

    const totalSavings = analysis.optimizations.reduce((sum, o) => sum + o.potentialSavings, 0);
    console.log(
      chalk.bold.green(`\n💡 Total Potential Savings: ${formatBytes(totalSavings)}\n`)
    );
  }

  private static createProgressBar(percentage: number, length: number): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}]`;
  }

  /**
   * Print simple loading message
   */
  static printLoading(message: string): void {
    console.log(chalk.cyan(`\n⏳ ${message}...\n`));
  }

  /**
   * Print success message
   */
  static printSuccess(message: string): void {
    console.log(chalk.green(`\n✅ ${message}\n`));
  }

  /**
   * Print error message
   */
  static printError(message: string): void {
    console.log(chalk.red(`\n❌ Error: ${message}\n`));
  }

  /**
   * Print dead code analysis
   */
  private static printDeadCode(deadCode: any): void {
    const totalFiles = deadCode.unusedFiles.length;
    const totalDeps = deadCode.unusedDependencies.length;
    const totalSavings = deadCode.totalSavings;

    if (totalFiles === 0 && totalDeps === 0) {
      console.log(
        chalk.bold('\n✅ No Dead Code Found\n'),
        chalk.gray('All files and dependencies are being used!')
      );
      return;
    }

    console.log(chalk.bold('\n🧹 Dead Code Analysis\n'));

    // Unused Files
    if (totalFiles > 0) {
      console.log(chalk.yellow(`\n📁 Unused Files (${totalFiles}):\n`));
      const fileTable = new Table({
        head: [chalk.cyan.bold('File'), chalk.cyan.bold('Size'), chalk.cyan.bold('Reason')],
        colWidths: [40, 12, 50],
      });

      deadCode.unusedFiles.slice(0, 10).forEach((file: any) => {
        fileTable.push([chalk.gray(file.path), formatBytes(file.size), chalk.gray(file.reason)]);
      });

      console.log(fileTable.toString());

      if (totalFiles > 10) {
        console.log(chalk.gray(`   ... and ${totalFiles - 10} more files\n`));
      }
    }

    // Unused Dependencies
    if (totalDeps > 0) {
      console.log(chalk.yellow(`\n📦 Unused Dependencies (${totalDeps}):\n`));
      const depsTable = new Table({
        head: [chalk.cyan.bold('Package'), chalk.cyan.bold('Version'), chalk.cyan.bold('Est. Size')],
        colWidths: [30, 15, 15],
      });

      deadCode.unusedDependencies.slice(0, 10).forEach((dep: any) => {
        depsTable.push([
          chalk.gray(dep.name),
          chalk.gray(dep.installedVersion),
          chalk.red(formatBytes(dep.estimatedSize)),
        ]);
      });

      console.log(depsTable.toString());

      if (totalDeps > 10) {
        console.log(chalk.gray(`   ... and ${totalDeps - 10} more dependencies\n`));
      }
    }

    console.log(chalk.bold.green(`\n💾 Total Potential Savings: ${formatBytes(totalSavings)}\n`));
  }

  /**
   * Print tree-shaking analysis
   */
  private static printTreeShake(treeShake: any): void {
    console.log(chalk.bold('\n🌲 Tree-Shaking Analysis\n'));

    const scoreColor =
      treeShake.score.score >= 80
        ? chalk.green
        : treeShake.score.score >= 50
        ? chalk.yellow
        : chalk.red;

    console.log(chalk.bold(`Tree-Shaking Score: ${scoreColor(treeShake.score.score + '/100')}\n`));

    // Score breakdown
    const statusTable = new Table({
      head: [chalk.cyan.bold('Check'), chalk.cyan.bold('Status')],
      colWidths: [40, 20],
    });

    statusTable.push(
      [
        'Uses ES6 Modules',
        treeShake.score.usesESModules ? chalk.green('✅ Yes') : chalk.red('❌ No'),
      ],
      [
        'Has Named Exports',
        treeShake.score.hasNamedExports ? chalk.green('✅ Yes') : chalk.yellow('⚠️  No'),
      ],
      [
        'Avoids Default Exports',
        !treeShake.score.hasDefaultExport ? chalk.green('✅ Yes') : chalk.yellow('⚠️  No'),
      ],
      [
        'No Side Effects',
        !treeShake.score.hasSideEffects ? chalk.green('✅ Yes') : chalk.red('❌ No'),
      ],
      [
        'package.json Configured',
        treeShake.score.packageJsonConfigured ? chalk.green('✅ Yes') : chalk.yellow('⚠️  No'),
      ]
    );

    console.log(statusTable.toString());

    // Issues
    if (treeShake.issues.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Found ${treeShake.issues.length} Issues:\n`));

      treeShake.issues.slice(0, 5).forEach((issue: any) => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️ ';
        console.log(
          `${icon} ${chalk.gray(issue.file)}\n` +
            `   ${chalk.yellow(issue.issue)}\n` +
            `   💡 ${chalk.green(issue.suggestion)}\n`
        );
      });

      if (treeShake.issues.length > 5) {
        console.log(chalk.gray(`   ... and ${treeShake.issues.length - 5} more issues\n`));
      }
    }

    // Side Effects
    if (treeShake.sideEffects.length > 0) {
      console.log(chalk.red(`\n🚨 Side Effects Detected (${treeShake.sideEffects.length}):\n`));

      treeShake.sideEffects.slice(0, 5).forEach((effect: any) => {
        const icon = effect.severity === 'error' ? '❌' : '⚠️ ';
        console.log(
          `${icon} ${chalk.gray(effect.file + ':' + effect.line)}\n` +
            `   ${chalk.yellow(effect.code)}\n` +
            `   Type: ${chalk.gray(effect.type)}\n`
        );
      });

      if (treeShake.sideEffects.length > 5) {
        console.log(chalk.gray(`   ... and ${treeShake.sideEffects.length - 5} more side effects\n`));
      }
    }

    // Recommendations
    if (treeShake.recommendations.length > 0) {
      console.log(chalk.bold('\n💡 Recommendations:\n'));
      treeShake.recommendations.forEach((rec: string, index: number) => {
        console.log(chalk.gray(`   ${index + 1}. ${rec}`));
      });
    }

    console.log(
      chalk.bold.green(`\n📊 Estimated Improvement: ${formatBytes(treeShake.estimatedImprovement)}\n`)
    );
  }
}
