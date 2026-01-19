#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { SourceCodeAnalyzer } from './analyzer/sourceCodeAnalyzer';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('rn-source-analyzer')
  .description('Analyze React Native project source code for unused dependencies and files')
  .version('1.0.0')
  .option('-p, --project <path>', 'Project root directory', process.cwd())
  .option('--json', 'Output JSON format', false)
  .action(async (options) => {
    try {
      const projectRoot = path.resolve(options.project);
      
      console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║                                                               ║'));
      console.log(chalk.cyan('║        ') + chalk.cyan.bold('React Native Source Code Analyzer') + chalk.cyan('              ║'));
      console.log(chalk.cyan('║                                                               ║'));
      console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝\n'));
      
      console.log(chalk.gray(`Analyzing project: ${projectRoot}\n`));
      
      // Run analysis
      const analyzer = new SourceCodeAnalyzer(projectRoot);
      const result = analyzer.analyze();
      
      if (options.json) {
        // Output JSON
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Print formatted report
        printReport(result, projectRoot);
      }
      
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), (error as Error).message);
      process.exit(1);
    }
  });

function printReport(result: any, projectRoot: string): void {
  // Used Dependencies
  console.log(chalk.bold('\n✅ Used Dependencies\n'));
  console.log(chalk.gray(`Found ${result.usedDependencies.length} dependencies in use:\n`));
  
  const usedTable = new Table({
    head: [chalk.cyan.bold('#'), chalk.cyan.bold('Package Name')],
    colWidths: [5, 50],
  });
  
  result.usedDependencies.forEach((dep: string, index: number) => {
    usedTable.push([chalk.gray((index + 1).toString()), dep]);
  });
  
  console.log(usedTable.toString());
  
  // Unused Dependencies
  if (result.unusedDependencies.length > 0) {
    console.log(chalk.bold('\n⚠️  Unused Dependencies\n'));
    console.log(chalk.yellow(`Found ${result.unusedDependencies.length} dependencies that are NOT imported in your source code:\n`));
    
    const unusedTable = new Table({
      head: [chalk.cyan.bold('#'), chalk.cyan.bold('Package Name')],
      colWidths: [5, 50],
    });
    
    result.unusedDependencies.forEach((dep: string, index: number) => {
      unusedTable.push([chalk.gray((index + 1).toString()), chalk.yellow(dep)]);
    });
    
    console.log(unusedTable.toString());
    
    // Show removal command
    console.log(chalk.bold('\n💡 To remove unused dependencies:\n'));
    console.log(chalk.gray('yarn remove ') + chalk.yellow(result.unusedDependencies.join(' ')));
    console.log(chalk.gray('# or'));
    console.log(chalk.gray('npm uninstall ') + chalk.yellow(result.unusedDependencies.join(' ')));
  } else {
    console.log(chalk.bold('\n✅ No Unused Dependencies\n'));
    console.log(chalk.gray('All dependencies in package.json are being used!'));
  }
  
  // Unused Files
  if (result.unusedFiles.length > 0) {
    console.log(chalk.bold('\n📁 Potentially Unused Files\n'));
    console.log(chalk.yellow(`Found ${result.unusedFiles.length} files that are not imported:\n`));
    
    const fileTable = new Table({
      head: [chalk.cyan.bold('#'), chalk.cyan.bold('File Path')],
      colWidths: [5, 70],
    });
    
    result.unusedFiles.slice(0, 20).forEach((file: string, index: number) => {
      fileTable.push([chalk.gray((index + 1).toString()), chalk.yellow(file)]);
    });
    
    console.log(fileTable.toString());
    
    if (result.unusedFiles.length > 20) {
      console.log(chalk.gray(`\n... and ${result.unusedFiles.length - 20} more files\n`));
    }
    
    console.log(chalk.bold('\n⚠️  Warning:'));
    console.log(chalk.gray('Please review these files carefully before deleting.'));
    console.log(chalk.gray('Some files may be used dynamically or in ways not detected by static analysis.'));
  } else {
    console.log(chalk.bold('\n✅ No Unused Files\n'));
    console.log(chalk.gray('All source files are being imported!'));
  }
  
  // Summary
  console.log(chalk.bold('\n📊 Summary\n'));
  console.log(chalk.gray(`Total source files: ${result.allFiles.length}`));
  console.log(chalk.gray(`Imported files: ${result.importedFiles.size}`));
  console.log(chalk.gray(`Used dependencies: ${result.usedDependencies.length}`));
  console.log(chalk.yellow(`Unused dependencies: ${result.unusedDependencies.length}`));
  console.log(chalk.yellow(`Potentially unused files: ${result.unusedFiles.length}`));
  
  console.log('\n');
}

program.parse();
