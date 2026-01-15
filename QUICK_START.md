# Quick Start Guide

Get started with React Native Bundle Analyzer in 5 minutes!

## Step 1: Install

```bash
npm install --save-dev rn-bundle-analyzer
```

## Step 2: Generate a Bundle

```bash
# iOS
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ./ios/main.jsbundle

# Android
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output ./android/app/src/main/assets/index.android.bundle
```

## Step 3: Analyze

```bash
# Basic analysis (terminal output)
npx rn-bundle-analyzer

# Open interactive web dashboard
npx rn-bundle-analyzer analyze --open
```

## Step 4: Optimize

Follow the suggestions in the report to reduce your bundle size!

Common optimizations:
- Replace heavy libraries (lodash → lodash-es, moment → date-fns)
- Use dynamic imports for large components
- Remove unused dependencies
- Deduplicate packages

## Next Steps

- Read the full [README.md](./README.md) for all features
- Check out [examples/](./examples/) for advanced usage
- Set up CI/CD integration for automated tracking
- Configure [.rnbundlerc.json](./.rnbundlerc.example.json) for your needs

## Need Help?

- Documentation: [README.md](./README.md)
- Issues: [GitHub Issues](https://github.com/nomanakram/react-native-bundle-analyzer/issues)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)

Happy optimizing! 🚀
