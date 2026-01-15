// Global analysis data
let analysisData = null;
let currentTab = 'overview';
let currentPage = {
  issues: 1,
  sideEffects: 1,
  unusedFiles: 1,
  unusedDeps: 1
};
const ITEMS_PER_PAGE = 50;

// Load analysis data
async function loadAnalysis() {
  try {
    const response = await fetch('/api/analysis');
    analysisData = await response.json();
    
    if (analysisData.error) {
      showError(analysisData.error);
      return;
    }
    
    renderApp();
  } catch (error) {
    showError('Failed to load analysis data');
  }
}

function showError(message) {
  document.getElementById('app').innerHTML = `
    <div class="section" style="text-align: center; padding: 60px;">
      <h2 style="color: #ef4444;">❌ Error</h2>
      <p style="color: #8b92a7;">${message}</p>
    </div>
  `;
}

function renderApp() {
  const app = document.getElementById('app');

  // Update header with project name
  const header = document.querySelector('header');
  if (header && analysisData.projectName) {
    header.innerHTML = `
      <h1>📦 ${analysisData.projectName}</h1>
      <p class="subtitle">React Native Bundle Analysis</p>
    `;
  }

  app.innerHTML = `
    <div class="tabs-container">
      <div class="tabs">
        <button class="tab active" onclick="switchTab('overview')">📊 Overview</button>
        <button class="tab" onclick="switchTab('packages')">📦 Packages</button>
        <button class="tab" onclick="switchTab('deadcode')">🧹 Dead Code</button>
        <button class="tab" onclick="switchTab('treeshake')">🌲 Tree-Shaking</button>
        <button class="tab" onclick="switchTab('optimizations')">💡 Optimizations</button>
      </div>
      <div id="tab-content"></div>
    </div>
  `;
  
  // Add tab styles
  const style = document.createElement('style');
  style.innerHTML = `
    .tabs-container { margin-top: 20px; }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      flex-wrap: wrap;
      border-bottom: 2px solid #2a3244;
      padding-bottom: 10px;
    }
    .tab {
      background: transparent;
      border: none;
      color: #8b92a7;
      padding: 12px 24px;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
      transition: all 0.2s;
      border-bottom: 3px solid transparent;
    }
    .tab:hover { color: #e6e6e6; background: rgba(102, 126, 234, 0.1); }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
      background: rgba(102, 126, 234, 0.1);
    }
    .file-path {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #8b92a7;
      background: #0f1419;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
    }
    .badge-error { background: #ef4444; color: white; }
    .badge-warning { background: #f59e0b; color: white; }
    .badge-success { background: #10b981; color: white; }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .table th {
      background: #0f1419;
      padding: 12px;
      text-align: left;
      color: #667eea;
      font-weight: 600;
      border-bottom: 2px solid #2a3244;
    }
    .table td {
      padding: 12px;
      border-bottom: 1px solid #2a3244;
    }
    .table tr:hover { background: #0f1419; }
    .score-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3em;
      font-weight: bold;
      margin: 20px auto;
      border: 5px solid;
    }
    .score-high { background: #10b981; border-color: #059669; color: white; }
    .score-medium { background: #f59e0b; border-color: #d97706; color: white; }
    .score-low { background: #ef4444; border-color: #dc2626; color: white; }
  `;
  document.head.appendChild(style);
  
  switchTab('overview');
}

function switchTab(tabName) {
  // Only reset pages if switching to a different tab
  if (currentTab !== tabName) {
    currentPage = {
      issues: 1,
      sideEffects: 1,
      unusedFiles: 1,
      unusedDeps: 1
    };
  }

  currentTab = tabName;

  // Update active tab
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.onclick && tab.onclick.toString().includes(`'${tabName}'`)) {
      tab.classList.add('active');
    }
  });

  const content = document.getElementById('tab-content');

  switch(tabName) {
    case 'overview': renderOverview(content); break;
    case 'packages': renderPackages(content); break;
    case 'deadcode': renderDeadCode(content); break;
    case 'treeshake': renderTreeShake(content); break;
    case 'optimizations': renderOptimizations(content); break;
  }
}

function renderOverview(container) {
  const totalSize = analysisData.totalSize;
  const yourCodePct = ((analysisData.yourCodeSize / totalSize) * 100).toFixed(1);
  const nodeModulesPct = ((analysisData.nodeModulesSize / totalSize) * 100).toFixed(1);
  const reactNativePct = ((analysisData.reactNativeSize / totalSize) * 100).toFixed(1);
  
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Bundle Size</div>
        <div class="stat-value">${formatBytes(totalSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Your Code</div>
        <div class="stat-value">${yourCodePct}%</div>
        <div style="color: #8b92a7; font-size: 0.9em;">${formatBytes(analysisData.yourCodeSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">node_modules</div>
        <div class="stat-value">${nodeModulesPct}%</div>
        <div style="color: #8b92a7; font-size: 0.9em;">${formatBytes(analysisData.nodeModulesSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">React Native</div>
        <div class="stat-value">${reactNativePct}%</div>
        <div style="color: #8b92a7; font-size: 0.9em;">${formatBytes(analysisData.reactNativeSize)}</div>
      </div>
    </div>
    
    ${analysisData.deadCode || analysisData.treeShake ? `
    <div class="stats-grid">
      ${analysisData.treeShake ? `
      <div class="stat-card">
        <div class="stat-label">Tree-Shaking Score</div>
        <div class="stat-value">${analysisData.treeShake.score.score}/100</div>
      </div>
      ` : ''}
      ${analysisData.deadCode ? `
      <div class="stat-card">
        <div class="stat-label">Unused Files</div>
        <div class="stat-value" style="color: #ef4444;">${analysisData.deadCode.unusedFiles.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unused Dependencies</div>
        <div class="stat-value" style="color: #f59e0b;">${analysisData.deadCode.unusedDependencies.length}</div>
      </div>
      ` : ''}
      ${analysisData.treeShake ? `
      <div class="stat-card">
        <div class="stat-label">Side Effects</div>
        <div class="stat-value" style="color: #ef4444;">${analysisData.treeShake.sideEffects.length}</div>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="section">
      <h2 class="section-title">📦 Top 10 Packages</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Size</th>
            <th>% of Bundle</th>
            <th>Modules</th>
          </tr>
        </thead>
        <tbody>
          ${analysisData.packages.slice(0, 10).map(pkg => `
            <tr>
              <td><strong>${pkg.name}</strong></td>
              <td>${formatBytes(pkg.size)}</td>
              <td>${pkg.percentage.toFixed(2)}%</td>
              <td>${pkg.modules.length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPackages(container) {
  if (!analysisData.packages || analysisData.packages.length === 0) {
    container.innerHTML = `
      <div class="section" style="text-align: center; padding: 40px;">
        <h2 style="color: #f59e0b;">⚠️ No Package Data Available</h2>
        <p style="color: #8b92a7; margin: 20px 0;">
          Package detection requires a sourcemap file to identify which modules belong to which packages.
        </p>
        <div style="background: #0f1419; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; text-align: left;">
          <h3 style="color: #667eea; margin-top: 0;">📝 How to generate bundle with sourcemap:</h3>
          <pre style="background: #000; padding: 15px; border-radius: 6px; overflow-x: auto; color: #10b981;">npx react-native bundle \\
  --platform android \\
  --dev false \\
  --entry-file index.js \\
  --bundle-output ./bundle.js \\
  --sourcemap-output ./bundle.map</pre>
          <p style="color: #8b92a7; margin: 10px 0 0 0; font-size: 0.9em;">
            Then run the analyzer again with the <code style="background: #000; padding: 2px 6px; border-radius: 3px;">--sourcemap</code> option.
          </p>
        </div>
        <p style="color: #8b92a7;">
          ✅ Other analysis features (dead code, tree-shaking, unused files) work without sourcemaps!
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="section">
      <h2 class="section-title">📦 All Packages (${analysisData.packages.length})</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Size</th>
            <th>% of Bundle</th>
            <th>Modules</th>
          </tr>
        </thead>
        <tbody>
          ${analysisData.packages.map(pkg => `
            <tr>
              <td><strong>${pkg.name}</strong></td>
              <td>${formatBytes(pkg.size)}</td>
              <td>${pkg.percentage.toFixed(2)}%</td>
              <td>${pkg.modules.length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDeadCode(container) {
  const deadCode = analysisData.deadCode;
  
  if (!deadCode || (deadCode.unusedFiles.length === 0 && deadCode.unusedDependencies.length === 0)) {
    container.innerHTML = `
      <div class="section">
        <h2 style="color: #10b981; text-align: center;">✅ No Dead Code Found!</h2>
        <p style="color: #8b92a7; text-align: center;">All files and dependencies are being used.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Unused Files</div>
        <div class="stat-value" style="color: #ef4444;">${deadCode.unusedFiles.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unused Dependencies</div>
        <div class="stat-value" style="color: #f59e0b;">${deadCode.unusedDependencies.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Savings</div>
        <div class="stat-value" style="color: #10b981;">${formatBytes(deadCode.totalSavings)}</div>
      </div>
    </div>
    
    ${deadCode.unusedFiles.length > 0 ? `
    <div class="section">
      <h2 class="section-title">📁 Unused Files (${deadCode.unusedFiles.length})</h2>
      <table class="table">
        <thead>
          <tr>
            <th>File</th>
            <th>Size</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${deadCode.unusedFiles.slice(
            (currentPage.unusedFiles - 1) * ITEMS_PER_PAGE,
            currentPage.unusedFiles * ITEMS_PER_PAGE
          ).map(file => `
            <tr>
              <td><span class="file-path">${file.path}</span></td>
              <td style="color: #ef4444;"><strong>${formatBytes(file.size)}</strong></td>
              <td style="color: #8b92a7;">${file.reason}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${createPagination(currentPage.unusedFiles, deadCode.unusedFiles.length, 'unusedFiles')}
    </div>
    ` : ''}
    
    ${deadCode.unusedDependencies.length > 0 ? `
    <div class="section">
      <h2 class="section-title">📦 Unused Dependencies (${deadCode.unusedDependencies.length})</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>Estimated Size</th>
          </tr>
        </thead>
        <tbody>
          ${deadCode.unusedDependencies.slice(
            (currentPage.unusedDeps - 1) * ITEMS_PER_PAGE,
            currentPage.unusedDeps * ITEMS_PER_PAGE
          ).map(dep => `
            <tr>
              <td><strong>${dep.name}</strong></td>
              <td>${dep.installedVersion}</td>
              <td style="color: #ef4444;"><strong>${formatBytes(dep.estimatedSize)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${createPagination(currentPage.unusedDeps, deadCode.unusedDependencies.length, 'unusedDeps')}
    </div>
    ` : ''}
  `;
}

function renderTreeShake(container) {
  const treeShake = analysisData.treeShake;
  
  if (!treeShake) {
    container.innerHTML = `<div class="section"><p style="color: #8b92a7; text-align: center;">No tree-shaking analysis available</p></div>`;
    return;
  }
  
  const scoreClass = treeShake.score.score >= 80 ? 'score-high' : treeShake.score.score >= 50 ? 'score-medium' : 'score-low';
  
  container.innerHTML = `
    <div class="section">
      <div class="score-circle ${scoreClass}">${treeShake.score.score}</div>
      <p style="text-align: center; color: #8b92a7;">Tree-Shaking Score out of 100</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">ES6 Modules</div>
        <div class="stat-value">${treeShake.score.usesESModules ? '✅' : '❌'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Named Exports</div>
        <div class="stat-value">${treeShake.score.hasNamedExports ? '✅' : '❌'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">No Default Exports</div>
        <div class="stat-value">${!treeShake.score.hasDefaultExport ? '✅' : '⚠️'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">No Side Effects</div>
        <div class="stat-value">${!treeShake.score.hasSideEffects ? '✅' : '❌'}</div>
      </div>
    </div>
    
    ${treeShake.issues.length > 0 ? `
    <div class="section">
      <h2 class="section-title">⚠️ Issues (${treeShake.issues.length})</h2>
      <table class="table">
        <thead>
          <tr>
            <th>File</th>
            <th>Issue</th>
            <th>Suggestion</th>
          </tr>
        </thead>
        <tbody>
          ${treeShake.issues.slice(
            (currentPage.issues - 1) * ITEMS_PER_PAGE,
            currentPage.issues * ITEMS_PER_PAGE
          ).map(issue => `
            <tr>
              <td><span class="file-path">${issue.file}</span></td>
              <td><span class="badge badge-${issue.severity === 'error' ? 'error' : 'warning'}">${issue.issue}</span></td>
              <td style="color: #10b981;">💡 ${issue.suggestion}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${createPagination(currentPage.issues, treeShake.issues.length, 'issues')}
    </div>
    ` : ''}
    
    ${treeShake.sideEffects.length > 0 ? `
    <div class="section">
      <h2 class="section-title">🚨 Side Effects (${treeShake.sideEffects.length})</h2>
      <table class="table">
        <thead>
          <tr>
            <th>File:Line</th>
            <th>Code</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${treeShake.sideEffects.slice(
            (currentPage.sideEffects - 1) * ITEMS_PER_PAGE,
            currentPage.sideEffects * ITEMS_PER_PAGE
          ).map(effect => `
            <tr>
              <td><span class="file-path">${effect.file}:${effect.line}</span></td>
              <td><code style="color: #f59e0b;">${effect.code}</code></td>
              <td><span class="badge badge-${effect.severity === 'error' ? 'error' : 'warning'}">${effect.type}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${createPagination(currentPage.sideEffects, treeShake.sideEffects.length, 'sideEffects')}
    </div>
    ` : ''}
  `;
}

function renderOptimizations(container) {
  if (!analysisData.optimizations || analysisData.optimizations.length === 0) {
    container.innerHTML = `
      <div class="section">
        <h2 style="color: #10b981; text-align: center;">✅ No Optimizations Needed!</h2>
        <p style="color: #8b92a7; text-align: center;">Your bundle is well optimized.</p>
      </div>
    `;
    return;
  }
  
  const totalSavings = analysisData.optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);
  
  container.innerHTML = `
    <div class="section">
      <div class="stat-card">
        <div class="stat-label">Total Potential Savings</div>
        <div class="stat-value" style="color: #10b981;">${formatBytes(totalSavings)}</div>
      </div>
    </div>
    
    <div class="section">
      <h2 class="section-title">💡 Suggestions (${analysisData.optimizations.length})</h2>
      ${analysisData.optimizations.map(opt => `
        <div class="optimization ${opt.severity}" style="margin-bottom: 15px;">
          <div class="optimization-title">${opt.severity === 'high' ? '🔴' : '🟡'} ${opt.suggestion.split('\n')[0]}</div>
          <div class="optimization-details">Package: ${opt.package}</div>
          <div class="optimization-details">Current: ${formatBytes(opt.currentSize)}</div>
          <div class="savings">💰 Savings: ${formatBytes(opt.potentialSavings)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function createPagination(currentPage, totalItems, pageType) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return '';

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 20px; background: #0f1419; border-radius: 8px;">
      <div style="color: #8b92a7;">
        Showing ${startItem}-${endItem} of ${totalItems}
      </div>
      <div style="display: flex; gap: 10px;">
        <button
          onclick="changePage('${pageType}', ${currentPage - 1})"
          ${currentPage === 1 ? 'disabled' : ''}
          style="padding: 8px 16px; background: ${currentPage === 1 ? '#1a1f2e' : '#667eea'}; color: ${currentPage === 1 ? '#4a5568' : 'white'}; border: none; border-radius: 6px; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'}; font-weight: 600;">
          ← Previous
        </button>
        <span style="color: #8b92a7; padding: 8px 16px;">
          Page ${currentPage} of ${totalPages}
        </span>
        <button
          onclick="changePage('${pageType}', ${currentPage + 1})"
          ${currentPage === totalPages ? 'disabled' : ''}
          style="padding: 8px 16px; background: ${currentPage === totalPages ? '#1a1f2e' : '#667eea'}; color: ${currentPage === totalPages ? '#4a5568' : 'white'}; border: none; border-radius: 6px; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-weight: 600;">
          Next →
        </button>
      </div>
    </div>
  `;
}

function changePage(pageType, newPage) {
  currentPage[pageType] = newPage;
  switchTab(currentTab);
}

// Load on page load
loadAnalysis();
