import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AssetIssue {
  type: 'large-image' | 'unoptimized-format' | 'unused-asset' | 'duplicate-asset';
  severity: 'high' | 'medium' | 'low';
  file: string;
  size: number;
  message: string;
  recommendation: string;
  duplicateOf?: string;
  hash?: string;
}

export interface AssetAnalysisResult {
  totalAssets: number;
  totalSize: number;
  imageCount: number;
  imageSize: number;
  largeImages: AssetIssue[];
  unoptimizedImages: AssetIssue[];
  unusedAssets: AssetIssue[];
  duplicateAssets: AssetIssue[];
  assetsByType: {
    [key: string]: {
      count: number;
      totalSize: number;
      files: string[];
    };
  };
  recommendations: {
    potentialSavings: number;
    webpConversion: number;
    duplicateRemoval: number;
    compressionSavings: number;
  };
  timestamp: string;
}

export class AssetAnalyzer {
  private projectRoot: string;
  private assets: Map<string, { path: string; size: number; hash: string }> = new Map();
  private imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  private assetExtensions = [
    ...this.imageExtensions,
    '.mp3', '.wav', '.m4a', '.aac',
    '.mp4', '.mov', '.avi',
    '.ttf', '.otf', '.woff', '.woff2',
    '.json', '.xml'
  ];

  // Size thresholds (in bytes)
  private LARGE_IMAGE_THRESHOLD = 500 * 1024; // 500KB
  private MEDIUM_IMAGE_THRESHOLD = 200 * 1024; // 200KB

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public async analyze(): Promise<AssetAnalysisResult> {
    console.log('🖼️  Starting asset analysis...');

    // Scan for assets
    await this.scanAssets();

    // Analyze issues
    const largeImages = this.findLargeImages();
    const unoptimizedImages = this.findUnoptimizedImages();
    const duplicateAssets = this.findDuplicateAssets();
    const unusedAssets = await this.findUnusedAssets();

    // Calculate statistics
    const assetsByType = this.categorizeAssets();
    const totalSize = Array.from(this.assets.values()).reduce((sum, asset) => sum + asset.size, 0);
    const imageAssets = Array.from(this.assets.entries()).filter(([_, asset]) =>
      this.imageExtensions.includes(path.extname(asset.path).toLowerCase())
    );
    const imageSize = imageAssets.reduce((sum, [_, asset]) => sum + asset.size, 0);

    // Calculate potential savings
    const recommendations = this.calculateRecommendations(
      largeImages,
      unoptimizedImages,
      duplicateAssets
    );

    console.log(`✅ Asset scan complete. Found ${this.assets.size} assets (${this.formatBytes(totalSize)})`);

    return {
      totalAssets: this.assets.size,
      totalSize,
      imageCount: imageAssets.length,
      imageSize,
      largeImages,
      unoptimizedImages,
      unusedAssets,
      duplicateAssets,
      assetsByType,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  private async scanAssets(): Promise<void> {
    const assetDirs = [
      path.join(this.projectRoot, 'src/assets'),
      path.join(this.projectRoot, 'assets'),
      path.join(this.projectRoot, 'public'),
      path.join(this.projectRoot, 'static'),
    ];

    for (const dir of assetDirs) {
      if (fs.existsSync(dir)) {
        await this.scanDirectory(dir);
      }
    }
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.assetExtensions.includes(ext)) {
          const stats = fs.statSync(fullPath);
          const hash = await this.calculateFileHash(fullPath);

          this.assets.set(fullPath, {
            path: fullPath,
            size: stats.size,
            hash,
          });
        }
      }
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private findLargeImages(): AssetIssue[] {
    const issues: AssetIssue[] = [];

    for (const [filePath, asset] of this.assets.entries()) {
      const ext = path.extname(filePath).toLowerCase();
      if (!this.imageExtensions.includes(ext)) continue;

      let severity: 'high' | 'medium' | 'low' = 'low';
      let message = '';

      if (asset.size > this.LARGE_IMAGE_THRESHOLD) {
        severity = 'high';
        message = `Very large image: ${this.formatBytes(asset.size)}`;
      } else if (asset.size > this.MEDIUM_IMAGE_THRESHOLD) {
        severity = 'medium';
        message = `Large image: ${this.formatBytes(asset.size)}`;
      } else {
        continue; // Skip small images
      }

      issues.push({
        type: 'large-image',
        severity,
        file: path.relative(this.projectRoot, filePath),
        size: asset.size,
        message,
        recommendation: 'Consider compressing this image or using a more efficient format like WebP. Tools: TinyPNG, ImageOptim, or sharp.',
      });
    }

    return issues.sort((a, b) => b.size - a.size);
  }

  private findUnoptimizedImages(): AssetIssue[] {
    const issues: AssetIssue[] = [];

    for (const [filePath, asset] of this.assets.entries()) {
      const ext = path.extname(filePath).toLowerCase();

      // Check if PNG or JPG could be converted to WebP
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const estimatedWebPSize = asset.size * 0.7; // WebP typically saves 30%
        const savings = asset.size - estimatedWebPSize;

        if (savings > 50 * 1024) { // Only suggest if savings > 50KB
          issues.push({
            type: 'unoptimized-format',
            severity: savings > 200 * 1024 ? 'high' : 'medium',
            file: path.relative(this.projectRoot, filePath),
            size: asset.size,
            message: `Could save ~${this.formatBytes(savings)} by converting to WebP`,
            recommendation: 'Convert to WebP format for better compression. Use: npx @squoosh/cli or sharp library.',
          });
        }
      }

      // Check for BMP (always suggest converting)
      if (ext === '.bmp') {
        issues.push({
          type: 'unoptimized-format',
          severity: 'high',
          file: path.relative(this.projectRoot, filePath),
          size: asset.size,
          message: 'BMP is an uncompressed format',
          recommendation: 'Convert to PNG or WebP for much better compression.',
        });
      }
    }

    return issues.sort((a, b) => b.size - a.size);
  }

  private findDuplicateAssets(): AssetIssue[] {
    const issues: AssetIssue[] = [];
    const hashMap = new Map<string, string[]>();

    // Group files by hash
    for (const [filePath, asset] of this.assets.entries()) {
      if (!hashMap.has(asset.hash)) {
        hashMap.set(asset.hash, []);
      }
      hashMap.get(asset.hash)!.push(filePath);
    }

    // Find duplicates
    for (const [hash, files] of hashMap.entries()) {
      if (files.length > 1) {
        const [original, ...duplicates] = files;
        const asset = this.assets.get(original)!;

        for (const duplicate of duplicates) {
          issues.push({
            type: 'duplicate-asset',
            severity: asset.size > 100 * 1024 ? 'high' : 'medium',
            file: path.relative(this.projectRoot, duplicate),
            size: asset.size,
            message: `Duplicate of ${path.basename(original)}`,
            recommendation: `Remove this duplicate file and use the original at ${path.relative(this.projectRoot, original)}`,
            duplicateOf: path.relative(this.projectRoot, original),
            hash,
          });
        }
      }
    }

    return issues.sort((a, b) => b.size - a.size);
  }

  private async findUnusedAssets(): Promise<AssetIssue[]> {
    const issues: AssetIssue[] = [];
    const srcDir = path.join(this.projectRoot, 'src');

    if (!fs.existsSync(srcDir)) {
      return issues;
    }

    // Get all source files
    const sourceFiles = this.getAllSourceFiles(srcDir);

    // Read all source file contents
    const sourceContents = sourceFiles.map(file => {
      try {
        return fs.readFileSync(file, 'utf-8');
      } catch {
        return '';
      }
    }).join('\n');

    // Check each asset
    for (const [filePath, asset] of this.assets.entries()) {
      const fileName = path.basename(filePath);
      const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

      // Check if asset is referenced in source code
      const isReferenced =
        sourceContents.includes(fileName) ||
        sourceContents.includes(fileNameWithoutExt) ||
        sourceContents.includes(filePath.replace(this.projectRoot, ''));

      if (!isReferenced) {
        issues.push({
          type: 'unused-asset',
          severity: asset.size > 100 * 1024 ? 'high' : 'low',
          file: path.relative(this.projectRoot, filePath),
          size: asset.size,
          message: 'Asset not referenced in source code',
          recommendation: 'Consider removing this unused asset to reduce bundle size.',
        });
      }
    }

    return issues.sort((a, b) => b.size - a.size);
  }

  private getAllSourceFiles(dirPath: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...this.getAllSourceFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private categorizeAssets(): { [key: string]: { count: number; totalSize: number; files: string[] } } {
    const categories: { [key: string]: { count: number; totalSize: number; files: string[] } } = {};

    for (const [filePath, asset] of this.assets.entries()) {
      const ext = path.extname(filePath).toLowerCase();

      if (!categories[ext]) {
        categories[ext] = { count: 0, totalSize: 0, files: [] };
      }

      categories[ext].count++;
      categories[ext].totalSize += asset.size;
      categories[ext].files.push(path.relative(this.projectRoot, filePath));
    }

    return categories;
  }

  private calculateRecommendations(
    largeImages: AssetIssue[],
    unoptimizedImages: AssetIssue[],
    duplicateAssets: AssetIssue[]
  ): {
    potentialSavings: number;
    webpConversion: number;
    duplicateRemoval: number;
    compressionSavings: number;
  } {
    // Calculate WebP conversion savings
    const webpConversion = unoptimizedImages
      .filter(i => i.message.includes('WebP'))
      .reduce((sum, issue) => {
        const match = issue.message.match(/~([\d.]+\s*[KMG]B)/);
        if (match) {
          return sum + this.parseSize(match[1]);
        }
        return sum + (issue.size * 0.3); // Default 30% savings
      }, 0);

    // Calculate duplicate removal savings
    const duplicateRemoval = duplicateAssets.reduce((sum, issue) => sum + issue.size, 0);

    // Estimate compression savings for large images
    const compressionSavings = largeImages
      .filter(i => i.severity === 'high')
      .reduce((sum, issue) => sum + (issue.size * 0.5), 0); // Estimate 50% reduction

    const potentialSavings = webpConversion + duplicateRemoval + compressionSavings;

    return {
      potentialSavings,
      webpConversion,
      duplicateRemoval,
      compressionSavings,
    };
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/([\d.]+)\s*([KMG]?B)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'KB': return value * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'GB': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public saveReport(outputPath: string, result: AssetAnalysisResult): void {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📄 Asset analysis report saved to ${outputPath}`);
  }
}
