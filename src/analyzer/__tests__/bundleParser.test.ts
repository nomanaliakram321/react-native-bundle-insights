import { BundleParser } from '../bundleParser';

describe('BundleParser', () => {
  describe('extractPackageName', () => {
    it('should extract package name from node_modules path', () => {
      const path = 'node_modules/lodash/index.js';
      expect(BundleParser.extractPackageName(path)).toBe('lodash');
    });

    it('should extract scoped package name', () => {
      const path = 'node_modules/@react-native-community/async-storage/index.js';
      expect(BundleParser.extractPackageName(path)).toBe(
        '@react-native-community/async-storage'
      );
    });

    it('should return undefined for non-node_modules paths', () => {
      const path = 'src/components/App.js';
      expect(BundleParser.extractPackageName(path)).toBeUndefined();
    });
  });

  describe('categorizeModule', () => {
    it('should categorize react-native modules', () => {
      const path = 'node_modules/react-native/Libraries/Core/InitializeCore.js';
      expect(BundleParser.categorizeModule(path)).toBe('react-native');
    });

    it('should categorize node_modules', () => {
      const path = 'node_modules/lodash/index.js';
      expect(BundleParser.categorizeModule(path)).toBe('node_modules');
    });

    it('should categorize user code', () => {
      const path = 'src/App.js';
      expect(BundleParser.categorizeModule(path)).toBe('user');
    });
  });

  describe('parse', () => {
    it('should parse simple bundle with __d function', () => {
      const bundleContent = `
        __d(function(g,r,i,a,m,e,d){
          var exports = {};
          exports.test = function() { return 42; };
          m.exports = exports;
        },123,[]);

        __d(function(g,r,i,a,m,e,d){
          var lodash = {};
          m.exports = lodash;
        },456,[]);
      `;

      const parser = new BundleParser(bundleContent);
      const modules = parser.parse();

      expect(modules.length).toBe(2);
      expect(modules[0].id).toBe(123);
      expect(modules[1].id).toBe(456);
      expect(modules[0].size).toBeGreaterThan(0);
      expect(modules[1].size).toBeGreaterThan(0);
    });

    it('should calculate module sizes', () => {
      const bundleContent = `__d(function(g,r,i,a,m,e,d){var x = 1;},1,"test.js");`;
      const parser = new BundleParser(bundleContent);
      const modules = parser.parse();

      expect(modules[0].size).toBeGreaterThan(0);
    });
  });

  describe('getTotalSize', () => {
    it('should return total bundle size', () => {
      const bundleContent = 'console.log("Hello World");';
      const parser = new BundleParser(bundleContent);
      const size = parser.getTotalSize();

      expect(size).toBe(new TextEncoder().encode(bundleContent).length);
    });
  });
});
