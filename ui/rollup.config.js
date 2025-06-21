// rollup.config.js
// Configuration to handle sharp dynamic requires for compatibility with build tools

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  plugins: [
    resolve({
      preferBuiltins: true,
      browser: false
    }),
    commonjs({
      // Handle sharp dynamic requires
      dynamicRequireTargets: [
        'node_modules/sharp/**/*'
      ],
      ignoreDynamicRequires: false,
      // Exclude sharp from bundling to avoid dynamic require issues
      exclude: ['node_modules/sharp/**']
    })
  ],
  external: [
    // Mark sharp as external to prevent bundling issues
    'sharp',
    // Other Node.js built-ins that should remain external
    'fs',
    'path',
    'os',
    'crypto'
  ]
};