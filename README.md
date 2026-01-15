# React Native Bundle Analyzer

A beautiful, powerful bundle analyzer for React Native - Visualize, analyze, and optimize your bundle size with ease!

## Features

- 📦 **Package-by-Package Breakdown** - Detailed analysis of every dependency with sizes
- 🧹 **Dead Code Detection** - Find unused files and dependencies automatically
- 🌲 **Tree-Shaking Analysis** - Identify non-tree-shakeable code with actionable suggestions
- 💡 **Smart Optimization Suggestions** - Get specific package alternatives (e.g., moment → dayjs)
- 🔍 **Duplicate Detection** - Find and eliminate duplicate packages wasting space
- 🎨 **Beautiful CLI Output** - Terminal UI with colored tables and progress bars
- 🌐 **Interactive Web Dashboard** - 5-tab interface with pagination for large datasets
- 📊 **Works Without Sourcemap** - Basic analysis works on any bundle
- 📈 **CI/CD Integration** - JSON export for automated bundle size tracking
- 🎯 **Project Name Display** - Personalized reports with your app name

## Installation

```bash
npm install -g react-native-bundle-analyzer
# or
yarn global add react-native-bundle-analyzer
```

## Quick Start

### 1. Generate a Bundle

First, create a bundle for analysis. **For best results, include a sourcemap:**

```bash
# For iOS (with sourcemap - recommended)
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ./ios/main.jsbundle \
  --sourcemap-output ./ios/main.jsbundle.map

# For Android (with sourcemap - recommended)
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output ./android/app/src/main/assets/index.android.bundle \
  --sourcemap-output ./android/app/src/main/assets/index.android.bundle.map
```

**Note:** The analyzer works without sourcemaps but package detection is limited. With sourcemaps you get:
- ✅ Accurate package-by-package breakdown
- ✅ node_modules vs your code separation
- ✅ Duplicate package detection

Without sourcemaps you still get:
- ✅ Total bundle size
- ✅ Dead code detection
- ✅ Tree-shaking analysis
- ✅ Unused dependencies detection

### 2. Analyze the Bundle

```bash
# Analyze with auto-detection
npx react-native-bundle-analyzer analyze

# Or specify the bundle path
npx react-native-bundle-analyzer analyze --bundle ./ios/main.jsbundle

# Open interactive visualization
npx react-native-bundle-analyzer analyze --open
```

## CLI Commands

### `analyze`

Analyze your React Native bundle and get detailed insights.

```bash
npx rn-bundle-analyzer analyze [options]
```

**Options:**

- `-b, --bundle <path>` - Path to the bundle file
- `-p, --platform <platform>` - Platform: ios or android (default: ios)
- `--dev` - Analyze development bundle (default: false)
- `-o, --output <path>` - Output directory for reports (default: .rn-bundle-analyzer)
- `--json` - Generate JSON report
- `--open` - Open interactive web visualization
- `--port <port>` - Port for visualization server (default: 8888)

**Examples:**

```bash
# Basic analysis
npx rn-bundle-analyzer analyze

# Analyze Android bundle
npx rn-bundle-analyzer analyze --platform android

# Generate JSON report
npx rn-bundle-analyzer analyze --json

# Open web dashboard
npx rn-bundle-analyzer analyze --open

# Specify custom bundle path
npx rn-bundle-analyzer analyze --bundle ./path/to/bundle.js
```

### `server`

Start the visualization server independently.

```bash
npx rn-bundle-analyzer server [options]
```

**Options:**

- `-p, --port <port>` - Port for the server (default: 8888)
- `-d, --data <path>` - Path to analysis data file

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "bundle:ios": "react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ./ios/main.jsbundle",
    "bundle:android": "react-native bundle --platform android --dev false --entry-file index.js --bundle-output ./android/app/src/main/assets/index.android.bundle",
    "analyze": "npm run bundle:ios && rn-bundle-analyzer analyze --open",
    "analyze:android": "npm run bundle:android && rn-bundle-analyzer analyze --platform android --open"
  }
}
```

Then run:

```bash
npm run analyze
```

## Programmatic Usage

You can also use the analyzer programmatically in your Node.js scripts:

```typescript
import { analyzeBundle, Reporter } from 'rn-bundle-analyzer';

async function analyze() {
  const analysis = await analyzeBundle('./ios/main.jsbundle');

  // Print beautiful CLI report
  Reporter.printReport(analysis);

  // Access data
  console.log('Total size:', analysis.totalSize);
  console.log('Top packages:', analysis.packages.slice(0, 5));
  console.log('Optimizations:', analysis.optimizations);
}

analyze();
```

## Output

### Terminal Output

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        React Native Bundle Analyzer                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📦 Bundle Summary

┌──────────────────────┬────────────────────────────────────────┐
│ Total Bundle Size    │ 2.5 MB                                 │
│                      │                                        │
│ Your Code            │ [███████████░░░░░░░░░] 45% (1.1MB)     │
│ node_modules         │ [█████████████████░░] 50% (1.2MB)      │
│ React Native         │ [██░░░░░░░░░░░░░░░░░] 5% (125KB)       │
└──────────────────────┴────────────────────────────────────────┘

📊 Top 10 Dependencies

┌─────────────────────────────────┬─────────┬─────────────┬─────────┐
│ Package                         │ Size    │ % of Bundle │ Modules │
├─────────────────────────────────┼─────────┼─────────────┼─────────┤
│ 1. lodash (4.17.21)            │ 500 KB  │ 20.00%      │ 342     │
│ 2. moment (2.29.4)             │ 350 KB  │ 14.00%      │ 156     │
│ 3. react-icons (4.11.0)        │ 200 KB  │ 8.00%       │ 89      │
└─────────────────────────────────┴─────────┴─────────────┴─────────┘

🎯 Optimization Suggestions

🔴 Replace lodash with lodash-es
   Package: lodash
   Current size: 500 KB
   Potential savings: 400 KB

🔴 Replace moment with date-fns
   Package: moment
   Current size: 350 KB
   Potential savings: 280 KB

💡 Total Potential Savings: 680 KB
```

### Web Dashboard

The interactive web dashboard provides **5 comprehensive tabs**:

#### 📊 Overview Tab
- Total bundle size with breakdown
- Code distribution (Your Code vs Dependencies vs React Native)
- Tree-shaking score summary
- Quick stats on unused code
- Top 10 packages table

#### 📦 Packages Tab
- Complete list of all dependencies
- Size and percentage for each package
- Module count per package
- Sortable and searchable table
- Helpful instructions if sourcemap is missing

#### 🧹 Dead Code Tab
- **Unused Files**: Files in your project never imported (with file paths and sizes)
- **Unused Dependencies**: npm packages installed but never used
- Estimated savings for each item
- Reasons why each item is considered unused
- **Paginated tables** (50 items per page) for easy browsing

#### 🌲 Tree-Shaking Tab
- **Overall Score**: 0-100 rating with color coding (green ≥80, yellow ≥50, red <50)
- **Score Breakdown**: ES6 modules, named exports, default exports, side effects checks
- **Issues Table**: Files using default exports or non-ES6 patterns (paginated)
- **Side Effects Table**: Detected side effects like console.log, global mutations (paginated)
- Specific file paths with line numbers
- Actionable suggestions for each issue
- Estimated improvement if fixed

#### 💡 Optimizations Tab
- Smart package replacement suggestions with alternatives
- Current size vs potential size after optimization
- Severity indicators (🔴 high, 🟡 medium, 🟢 low)
- Specific reasons for each suggestion
- Total potential savings calculation

**Key Features:**
- Modern dark theme optimized for readability
- Pagination for large datasets (no more endless scrolling!)
- Responsive design works on all screen sizes
- Smooth animations and transitions
- Project name displayed in header

## CI/CD Integration

### GitHub Actions

```yaml
name: Bundle Size Check

on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Generate bundle
        run: npm run bundle:ios

      - name: Analyze bundle
        run: npx rn-bundle-analyzer analyze --json

      - name: Upload report
        uses: actions/upload-artifact@v3
        with:
          name: bundle-analysis
          path: .rn-bundle-analyzer/
```

## Configuration

Create a `.rnbundlerc.json` file in your project root:

```json
{
  "platform": "ios",
  "bundlePath": "./ios/main.jsbundle",
  "outputDir": ".rn-bundle-analyzer",
  "port": 8888,
  "thresholds": {
    "maxBundleSize": 5242880,
    "maxPackageSize": 524288
  }
}
```

## Tips for Optimization

### 1. Replace Heavy Libraries

- **lodash** → **lodash-es** (better tree-shaking)
- **moment** → **date-fns** (80% smaller)
- **axios** → **fetch API** or **ky** (smaller alternatives)

### 2. Use Dynamic Imports

```javascript
// Instead of
import HeavyComponent from './HeavyComponent';

// Use
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

### 3. Optimize Icon Libraries

```javascript
// Instead of importing all icons
import { Icon } from 'react-icons/fa';

// Import only what you need
import { FaBeer } from 'react-icons/fa';
```

### 4. Enable Hermes

Add to `android/app/build.gradle`:

```gradle
project.ext.react = [
    enableHermes: true
]
```

## Troubleshooting

### Bundle Not Found

If the analyzer can't find your bundle:

1. Make sure you've generated a bundle first
2. Specify the path explicitly: `--bundle ./path/to/bundle`
3. Check the platform matches: `--platform ios` or `--platform android`

### Parse Errors

If the bundle can't be parsed:

1. Ensure the bundle is a production build (not dev)
2. Try regenerating the bundle
3. Check Metro bundler version compatibility

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

- GitHub Issues: [https://github.com/nomanakram/react-native-bundle-analyzer/issues](https://github.com/nomanakram/react-native-bundle-analyzer/issues)
- Twitter: [@nomanakram](https://twitter.com/nomanakram)

---

Made with ❤️ by Noman Akram
