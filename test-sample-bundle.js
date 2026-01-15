#!/usr/bin/env node

/**
 * Create a sample Metro bundle for testing
 * This simulates what a real React Native bundle looks like
 */

const fs = require('fs');
const path = require('path');

const sampleBundle = `
// Sample Metro bundle for testing
__d(function(g,r,i,a,m,e,d){
  "use strict";
  Object.defineProperty(e,"__esModule",{value:!0});
  e.default=function(){
    return "Hello from App";
  }
},0,"src/App.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var lodash = {};
  lodash.debounce = function(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  };
  lodash.map = function(array, fn) {
    return array.map(fn);
  };
  lodash.filter = function(array, fn) {
    return array.filter(fn);
  };
  // Add more lodash functions to increase size...
  var loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100);
  m.exports = lodash;
},1,"node_modules/lodash/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var moment = function(date) {
    return {
      format: function(fmt) {
        return date.toString();
      },
      add: function(val, unit) {
        return moment(date);
      },
      subtract: function(val, unit) {
        return moment(date);
      }
    };
  };
  // Simulate large moment.js library
  var localeData = "Locale data here...".repeat(200);
  var timezoneData = "Timezone data here...".repeat(150);
  m.exports = moment;
},2,"node_modules/moment/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var axios = {
    get: function(url, config) {
      return Promise.resolve({ data: {} });
    },
    post: function(url, data, config) {
      return Promise.resolve({ data: {} });
    },
    put: function(url, data, config) {
      return Promise.resolve({ data: {} });
    },
    delete: function(url, config) {
      return Promise.resolve({ data: {} });
    }
  };
  var axiosUtils = "Axios utilities...".repeat(80);
  m.exports = axios;
},3,"node_modules/axios/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var React = {
    createElement: function(type, props, children) {
      return { type: type, props: props, children: children };
    },
    Component: function() {},
    useState: function(initial) {
      return [initial, function() {}];
    },
    useEffect: function(fn) {
      fn();
    }
  };
  m.exports = React;
},4,"node_modules/react/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var ReactNative = {
    View: "View",
    Text: "Text",
    Image: "Image",
    ScrollView: "ScrollView",
    FlatList: "FlatList",
    TouchableOpacity: "TouchableOpacity"
  };
  // Simulate React Native core
  var nativeModules = "Native module definitions...".repeat(50);
  m.exports = ReactNative;
},5,"node_modules/react-native/Libraries/ReactNative.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var components = {
    Button: function() { return "Button"; },
    Header: function() { return "Header"; },
    Footer: function() { return "Footer"; }
  };
  m.exports = components;
},6,"src/components/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var utils = {
    formatDate: function(date) { return date.toString(); },
    validateEmail: function(email) { return true; },
    parseJSON: function(str) { return JSON.parse(str); }
  };
  m.exports = utils;
},7,"src/utils/helpers.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  // Duplicate lodash from different path (simulating duplicate)
  var lodash = {
    debounce: function(func, wait) {
      return func;
    }
  };
  m.exports = lodash;
},8,"node_modules/some-package/node_modules/lodash/index.js");

__d(function(g,r,i,a,m,e,d){
  "use strict";
  var reactIcons = {
    FaBeer: "🍺",
    FaCoffee: "☕",
    FaHome: "🏠",
    FaUser: "👤"
  };
  // Simulate large icon library
  var iconData = "Icon definitions...".repeat(300);
  m.exports = reactIcons;
},9,"node_modules/react-icons/fa/index.js");

// Initialize app
__r(0);
`;

// Create test directory
const testDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Write sample bundle
const bundlePath = path.join(testDir, 'sample.bundle.js');
fs.writeFileSync(bundlePath, sampleBundle, 'utf-8');

console.log('✅ Sample bundle created at:', bundlePath);
console.log('\nYou can now test the analyzer with:');
console.log(`npx rn-bundle-analyzer analyze --bundle ${bundlePath}`);
console.log(`npx rn-bundle-analyzer analyze --bundle ${bundlePath} --open`);
