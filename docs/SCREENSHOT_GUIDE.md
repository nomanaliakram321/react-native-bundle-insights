# Screenshot Guide for React Native Bundle Insights

This guide will help you capture professional screenshots for the README.

## Required Screenshots Checklist

### Priority 1 (Must Have)

- [ ] `dashboard-overview.png` - Main dashboard showing all 5 tabs
- [ ] `dashboard-bundle-treemap.png` - Bundle treemap tab with interactive visualization
- [ ] `dashboard-dependencies.png` - Dependencies tab showing used/unused packages
- [ ] `dashboard-unused-imports.png` - Unused imports with line numbers
- [ ] `dashboard-security.png` - Security issues by severity
- [ ] `dashboard-assets.png` - Asset analysis with optimization suggestions
- [ ] `terminal-analysis.png` - Terminal output of complete analysis

### Priority 2 (Nice to Have)

- [ ] `package-breakdown.png` - Top 10 packages table
- [ ] `optimization-suggestions.png` - Optimization recommendations
- [ ] `responsive-desktop.png` - Desktop view
- [ ] `responsive-mobile.png` - Mobile view
- [ ] `logo.png` - Project logo (400x100px recommended)

## Step-by-Step Screenshot Instructions

### 1. Dashboard Overview (`dashboard-overview.png`)

**What to capture:**
- Full browser window showing the unified dashboard
- All 5 tabs visible in the navigation
- Current tab showing meaningful data
- Project name in header

**Steps:**
1. Run: `npx react-native-bundle-insights all`
2. Wait for dashboard to open at http://localhost:8893
3. Ensure you're on a tab with data (Bundle Treemap or Dependencies)
4. Capture full browser window
5. Crop to remove browser chrome (optional)

**Recommended size:** 1920x1080 or 1600x900

---

### 2. Bundle Treemap (`dashboard-bundle-treemap.png`)

**What to capture:**
- Interactive treemap visualization
- Hover tooltip showing package details (if possible)
- Legend showing color coding
- Size breakdown visible

**Steps:**
1. Navigate to "Bundle Treemap" tab
2. Hover over a large package to show tooltip
3. Capture the visualization
4. Ensure colors are clearly visible

**Key elements to show:**
- Different colored boxes (blue, green, yellow)
- Size proportions
- Package names
- Hover tooltip (optional but nice)

---

### 3. Dependencies Tab (`dashboard-dependencies.png`)

**What to capture:**
- List of used dependencies
- Unused dependencies section
- Potentially unused files
- Summary statistics

**Steps:**
1. Navigate to "Dependencies" tab
2. Scroll to show both used and unused sections
3. Capture full tab content
4. Ensure removal commands are visible

**Key elements:**
- ✅ Used dependencies list
- ❌ Unused dependencies with yarn/npm commands
- 📁 Unused files list
- 📊 Summary stats at bottom

---

### 4. Unused Imports (`dashboard-unused-imports.png`)

**What to capture:**
- File-by-file unused import analysis
- Line numbers and import statements
- Potential savings calculation

**Steps:**
1. Navigate to "Unused Imports" tab
2. Show at least 3-5 files with unused imports
3. Ensure line numbers are visible
4. Capture the table

**Key elements:**
- File paths
- Line numbers
- Unused import statements
- Potential savings

---

### 5. Security Tab (`dashboard-security.png`)

**What to capture:**
- Security issues grouped by severity
- Critical, High, Medium, Low sections
- File paths and line numbers
- Issue descriptions

**Steps:**
1. Navigate to "Security" tab
2. Expand at least one severity level
3. Show variety of issue types
4. Capture full tab

**Key elements:**
- 🔴 Critical issues
- 🟠 High issues
- 🟡 Medium issues
- 🟢 Low issues
- File paths and line numbers

---

### 6. Assets Tab (`dashboard-assets.png`)

**What to capture:**
- Asset summary statistics
- Large images list
- Duplicate assets
- Optimization suggestions
- Potential savings

**Steps:**
1. Navigate to "Assets" tab
2. Show summary section
3. Scroll to show different issue types
4. Capture full tab

**Key elements:**
- 📊 Summary stats
- 🖼️ Large images
- 🔄 Duplicates
- ♻️ Unoptimized formats
- 💰 Potential savings

---

### 7. Terminal Output (`terminal-analysis.png`)

**What to capture:**
- Command being run
- Progress indicators
- Colored output
- Success messages
- Dashboard URL

**Steps:**
1. Open terminal
2. Run: `npx react-native-bundle-insights all`
3. Wait for completion
4. Capture terminal window
5. Ensure colors are visible

**Key elements:**
- Command prompt
- Progress messages
- Success checkmarks ✅
- Dashboard URL
- Summary statistics

---

### 8. Package Breakdown (`package-breakdown.png`)

**What to capture:**
- Top 10 dependencies table
- Package names, sizes, percentages
- Module counts

**Steps:**
1. Run bundle analysis
2. Look at terminal output
3. Find "Top 10 Dependencies" table
4. Capture just the table

**Alternative:** Capture from web dashboard if available

---

### 9. Optimization Suggestions (`optimization-suggestions.png`)

**What to capture:**
- List of optimization suggestions
- Severity indicators
- Potential savings
- Specific recommendations

**Steps:**
1. Look for optimization section in terminal or dashboard
2. Capture suggestions with icons
3. Show potential savings

---

### 10. Responsive Views

**Desktop (`responsive-desktop.png`):**
- Full width dashboard (1920px+)
- All elements visible
- Sidebar expanded

**Mobile (`responsive-mobile.png`):**
- Mobile view (375px width)
- Hamburger menu visible
- Content stacked vertically

**Steps:**
1. Open browser DevTools (F12)
2. Toggle device toolbar
3. Select iPhone or Android device
4. Capture mobile view
5. Switch back to desktop
6. Capture desktop view

---

## Screenshot Editing Tips

### Tools
- **macOS**: Preview, Pixelmator, Sketch
- **Windows**: Paint, Paint.NET, GIMP
- **Linux**: GIMP, Krita
- **Online**: Photopea, Canva

### Editing Checklist
1. ✅ Crop to remove unnecessary borders
2. ✅ Resize to reasonable dimensions (max 1920px width)
3. ✅ Optimize file size (use PNG compression)
4. ✅ Add annotations if needed (arrows, highlights)
5. ✅ Ensure text is readable
6. ✅ Check colors are accurate

### Annotations
Use tools like:
- **Skitch** (macOS) - Easy annotations
- **Greenshot** (Windows) - Screenshot + annotations
- **Flameshot** (Linux) - Powerful screenshot tool
- **Snagit** (All platforms) - Professional tool

---

## File Naming Convention

Use descriptive, lowercase names with hyphens:

✅ Good:
- `dashboard-bundle-treemap.png`
- `terminal-analysis.png`
- `optimization-suggestions.png`

❌ Bad:
- `Screenshot 2024-01-18.png`
- `IMG_1234.png`
- `Untitled.png`

---

## File Size Guidelines

- **Maximum file size**: 500KB per image
- **Recommended format**: PNG for UI screenshots
- **Compression**: Use TinyPNG or ImageOptim

### Compression Tools
```bash
# Install ImageOptim (macOS)
brew install imageoptim

# Install pngquant (all platforms)
npm install -g pngquant-bin

# Compress images
pngquant --quality=65-80 input.png -o output.png
```

---

## Adding Screenshots to README

Once you have the screenshots:

1. Save them in `docs/screenshots/` directory
2. Commit them to git:
   ```bash
   git add docs/screenshots/*.png
   git commit -m "Add screenshots for README"
   ```
3. Push to GitHub:
   ```bash
   git push origin main
   ```
4. Screenshots will automatically appear in README on GitHub

---

## Creating a Logo

### Option 1: Use a Logo Generator
- **Canva**: https://www.canva.com/create/logos/
- **Hatchful**: https://www.shopify.com/tools/logo-maker
- **LogoMakr**: https://logomakr.com/

### Option 2: Design Your Own
- Use Figma, Sketch, or Adobe Illustrator
- Recommended size: 400x100px
- Include: React Native icon + "Bundle Insights" text
- Export as PNG with transparent background

### Option 3: Text-Based Logo
Create a simple text logo using ASCII art or styled text:

```
╔═══════════════════════════════════════╗
║  React Native Bundle Insights  📊     ║
║  Analyze • Optimize • Visualize       ║
╚═══════════════════════════════════════╝
```

---

## Testing Screenshots

Before committing, test that they display correctly:

1. View README locally:
   ```bash
   # Install markdown viewer
   npm install -g markdown-preview

   # Preview README
   markdown-preview README.md
   ```

2. Check on GitHub:
   - Push to a test branch
   - View on GitHub to ensure images load
   - Check on mobile view

3. Verify:
   - [ ] All images load correctly
   - [ ] Images are not too large (file size)
   - [ ] Text is readable
   - [ ] Colors are accurate
   - [ ] Layout looks good on mobile

---

## Example Screenshot Workflow

```bash
# 1. Run analysis
npx react-native-bundle-insights all

# 2. Take screenshots (macOS)
# Press Cmd+Shift+4, then drag to select area

# 3. Move screenshots to docs folder
mv ~/Desktop/Screenshot*.png docs/screenshots/

# 4. Rename files
cd docs/screenshots
mv Screenshot\ 2024-01-18\ at\ 10.30.45.png dashboard-overview.png

# 5. Optimize images
pngquant --quality=65-80 *.png --ext .png --force

# 6. Commit and push
git add docs/screenshots/*.png
git commit -m "Add dashboard screenshots"
git push origin main
```

---

## Need Help?

If you need help with screenshots:
1. Check existing examples in other popular repos
2. Use browser DevTools for consistent captures
3. Ask in GitHub Discussions
4. Reference this guide

Happy screenshotting! 📸
