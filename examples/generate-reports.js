#!/usr/bin/env node

/**
 * Example: Generate multiple report formats
 */

const { analyzeBundle } = require('../dist');
const { ReportGenerator } = require('../dist/utils/reportGenerator');
const path = require('path');

async function generateReports() {
  try {
    console.log('Analyzing bundle and generating reports...\n');

    const bundlePath = path.join(__dirname, '../ios/main.jsbundle');
    const analysis = await analyzeBundle(bundlePath);

    const outputDir = path.join(__dirname, '../reports');

    // Generate HTML report
    const htmlPath = path.join(outputDir, 'report.html');
    ReportGenerator.generateHtmlReport(analysis, htmlPath);
    console.log(`✅ HTML report generated: ${htmlPath}`);

    // Generate Markdown report
    const mdPath = path.join(outputDir, 'report.md');
    ReportGenerator.generateMarkdownReport(analysis, mdPath);
    console.log(`✅ Markdown report generated: ${mdPath}`);

    // Generate CSV report
    const csvPath = path.join(outputDir, 'packages.csv');
    ReportGenerator.generateCsvReport(analysis, csvPath);
    console.log(`✅ CSV report generated: ${csvPath}`);

    console.log('\n✨ All reports generated successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

generateReports();
