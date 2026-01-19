# Web Visualization Guide - Step 1

This guide explains how to test the new Step 1 web visualization feature.

## What's New in Version 1.0.3

Added interactive web dashboard for **Step 1: Dependency Usage Analysis**

### Features:
- 📊 Visual stats cards showing total/used/unused dependencies
- 📈 Interactive table with usage percentages
- 🎨 Beautiful dark theme (GitHub-inspired)
- 📁 File lists showing which files use each dependency
- 🔍 Expandable file lists for dependencies used in many files

## Quick Test Instructions

### Option 1: Run the Build Script (Recommended)

```bash
cd /Users/nomanakram/Documents/projects/react-native-bundle-insights
chmod +x build-and-test-step1.sh
./build-and-test-step1.sh
```

This will:
1. Build the package
2. Update it in Chughtai Lab project
3. Launch the web visualization automatically

### Option 2: Manual Steps

```bash
# 1. Build the package
cd /Users/nomanakram/Documents/projects/react-native-bundle-insights
npm run build

# 2. Update in your project
cd /Users/nomanakram/Documents/GitHub/chughtai-lab-mobile
yarn upgrade react-native-bundle-insights

# 3. Run with web visualization
npx react-native-bundle-insights source-analyze --open
```

## Command Options

```bash
# Open web visualization (default port 8889)
npx react-native-bundle-insights source-analyze --open

# Use custom port
npx react-native-bundle-insights source-analyze --open --port 3000

# Output JSON only (no web)
npx react-native-bundle-insights source-analyze --json

# Analyze different project directory
npx react-native-bundle-insights source-analyze --project /path/to/project --open
```

## What You'll See

### Stats Dashboard:
- **Total Dependencies**: All dependencies in package.json
- **Used Dependencies**: Dependencies found in your source code
- **Unused Dependencies**: Dependencies NOT imported anywhere
- **Total Project Files**: Number of source files analyzed

### Dependency Table:
Each row shows:
- Dependency name and version
- Status badge (Used/Unused)
- Usage count (how many times imported)
- Files using (how many files import it)
- Usage percentage (% of files that use it)
- Visual bar graph of usage
- List of first 5 files using it (expandable)

### Unused Section:
Red badges showing all dependencies that can potentially be removed

## Example Output

For Chughtai Lab project, you should see accurate results like:
- Which React Navigation packages are used and in how many files
- Which UI libraries are most heavily used
- Exact file lists showing where each dependency is imported
- Clear identification of unused dependencies

## Next Steps (Future Versions)

- **Step 2**: Bundle size analysis with treemap visualization
- **Step 3**: Dead code detection and visualization
- **Step 4**: Optimization recommendations

## Troubleshooting

### Build fails:
```bash
# Make sure you're in the right directory
cd /Users/nomanakram/Documents/projects/react-native-bundle-insights

# Check TypeScript is installed
npm install

# Try build again
npm run build
```

### Browser doesn't open:
The server will still be running. Manually open: http://localhost:8889

### Package not updating:
```bash
# Force reinstall
cd /Users/nomanakram/Documents/GitHub/chughtai-lab-mobile
yarn remove react-native-bundle-insights
yarn add react-native-bundle-insights@latest
```

## Technical Details

- **Analyzer**: `src/analyzer/sourceCodeAnalyzer.ts`
- **CLI**: `src/cli.ts` (lines 71-322)
- **Web Dashboard**: `public/source-analysis.html`
- **Server**: Express server on port 8889 (default)
- **API Endpoint**: `/api/source-analysis`

The analyzer:
1. Reads package.json dependencies
2. Scans all files in `src/` directory
3. Extracts all imports/requires using regex
4. Builds import graph
5. Counts usage per dependency
6. Calculates percentages
7. Identifies unused dependencies

**Note**: This is SOURCE code analysis, NOT bundle analysis. It's always accurate regardless of whether you have sourcemaps or not!
