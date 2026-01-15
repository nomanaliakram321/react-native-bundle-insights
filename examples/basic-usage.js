#!/usr/bin/env node

/**
 * Basic usage example of React Native Bundle Analyzer
 */

const { analyzeBundle, Reporter } = require('../dist');
const path = require('path');

async function main() {
  try {
    console.log('Starting bundle analysis...\n');

    // Path to your bundle file
    const bundlePath = path.join(__dirname, '../ios/main.jsbundle');

    // Analyze the bundle
    const analysis = await analyzeBundle(bundlePath);

    // Print beautiful report to console
    Reporter.printReport(analysis);

    // Access specific data
    console.log('\n--- Custom Analysis ---\n');
    console.log(`Total packages: ${analysis.packages.length}`);
    console.log(`Total optimizations: ${analysis.optimizations.length}`);
    console.log(`Total duplicates: ${analysis.duplicates.length}`);

    // Find specific packages
    const lodash = analysis.packages.find((p) => p.name === 'lodash');
    if (lodash) {
      console.log(`\nLodash size: ${(lodash.size / 1024).toFixed(2)} KB`);
    }

    // List all high-priority optimizations
    const highPriority = analysis.optimizations.filter((o) => o.severity === 'high');
    console.log(`\nHigh priority optimizations: ${highPriority.length}`);
    highPriority.forEach((opt) => {
      console.log(`  - ${opt.suggestion}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
