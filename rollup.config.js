import { nodeResolve } from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';

const input = {
  sw: 'extension/sw.js',
  popup: 'extension/popup.js',
  options: 'extension/options.js'
};

export default {
  input,
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js'
  },
  plugins: [
    nodeResolve(),
    copy({
      targets: [
        { src: 'extension/manifest.json', dest: 'dist' },
        { src: 'extension/*.html', dest: 'dist' },
        { src: 'extension/*.css', dest: 'dist' },
        { src: 'extension/icons', dest: 'dist' }
      ],
      copyOnce: true
    })
  ],
  preserveEntrySignatures: 'strict'
};
