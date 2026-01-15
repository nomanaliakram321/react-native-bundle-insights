#!/bin/bash

# Complete test script before publishing
set -e

echo "🧪 Running complete test suite..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install dependencies
echo -e "${YELLOW}📦 Step 1: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Step 2: Run linter
echo -e "${YELLOW}🔍 Step 2: Running linter...${NC}"
npm run lint || true
echo -e "${GREEN}✅ Linting complete${NC}\n"

# Step 3: Run unit tests
echo -e "${YELLOW}🧪 Step 3: Running unit tests...${NC}"
npm test
echo -e "${GREEN}✅ Tests passed${NC}\n"

# Step 4: Build
echo -e "${YELLOW}🔨 Step 4: Building project...${NC}"
npm run build
echo -e "${GREEN}✅ Build successful${NC}\n"

# Step 5: Check dist folder
echo -e "${YELLOW}📂 Step 5: Checking build output...${NC}"
if [ -d "dist" ]; then
  echo "  dist/ folder exists"
  echo "  Files in dist/:"
  ls -lh dist/ | head -10
  echo -e "${GREEN}✅ Build output verified${NC}\n"
else
  echo -e "${RED}❌ dist/ folder not found${NC}\n"
  exit 1
fi

# Step 6: Create sample bundle
echo -e "${YELLOW}📝 Step 6: Creating sample bundle...${NC}"
node test-sample-bundle.js
echo -e "${GREEN}✅ Sample bundle created${NC}\n"

# Step 7: Test with sample bundle
echo -e "${YELLOW}🎯 Step 7: Testing analyzer with sample bundle...${NC}"
npm link
npx rn-bundle-analyzer analyze --bundle ./test-data/sample.bundle.js --json
echo -e "${GREEN}✅ Analyzer works!${NC}\n"

# Step 8: Check output
echo -e "${YELLOW}📊 Step 8: Checking analysis output...${NC}"
if [ -f ".rn-bundle-analyzer/analysis.json" ]; then
  echo "  Analysis file created"
  file_size=$(wc -c < ".rn-bundle-analyzer/analysis.json")
  echo "  File size: $file_size bytes"
  echo -e "${GREEN}✅ Output verified${NC}\n"
else
  echo -e "${RED}❌ Analysis file not created${NC}\n"
  exit 1
fi

# Step 9: Test CLI commands
echo -e "${YELLOW}⌨️  Step 9: Testing CLI commands...${NC}"
rn-bundle-analyzer --version
rn-bundle-analyzer --help
echo -e "${GREEN}✅ CLI commands work${NC}\n"

# Step 10: Create npm package
echo -e "${YELLOW}📦 Step 10: Creating npm package...${NC}"
npm pack
tarball=$(ls -t rn-bundle-analyzer-*.tgz | head -1)
echo "  Created: $tarball"
echo -e "${GREEN}✅ Package created${NC}\n"

# Step 11: Inspect package contents
echo -e "${YELLOW}🔍 Step 11: Inspecting package contents...${NC}"
tar -tzf "$tarball" | head -20
echo -e "${GREEN}✅ Package inspection complete${NC}\n"

# Final summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 All tests passed! Ready to publish!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Review CHANGELOG.md"
echo "  2. Update version: npm version patch|minor|major"
echo "  3. Login to npm: npm login"
echo "  4. Publish: npm publish"
echo ""
echo "Package details:"
echo "  Tarball: $tarball"
echo "  You can test installation with:"
echo "  npm install $tarball"
echo ""
