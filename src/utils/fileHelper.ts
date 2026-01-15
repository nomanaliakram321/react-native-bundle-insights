import * as fs from 'fs';
import * as path from 'path';

export function findBundleFile(platform: 'ios' | 'android' = 'ios', dev = false): string | null {
  const possiblePaths = [
    // iOS paths
    `ios/main.jsbundle`,
    `ios/build/Build/Products/Debug-iphonesimulator/main.jsbundle`,
    `ios/build/Build/Products/Release-iphoneos/main.jsbundle`,

    // Android paths
    `android/app/build/generated/assets/react/release/index.android.bundle`,
    `android/app/build/generated/assets/react/debug/index.android.bundle`,

    // Common paths
    `index.${platform}.bundle`,
    `main.jsbundle`,
  ];

  for (const bundlePath of possiblePaths) {
    const fullPath = path.resolve(process.cwd(), bundlePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

export function readBundleFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bundle file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function writeJsonFile(filePath: string, data: any): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
