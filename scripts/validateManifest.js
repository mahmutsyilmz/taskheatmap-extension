#!/usr/bin/env node
import { readFileSync, accessSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function validateManifest(manifestPath, schemaPath) {
  const manifest = loadJson(manifestPath);
  const schema = loadJson(schemaPath);

  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid) {
    const message = ajv.errorsText(validate.errors, { separator: '\n' });
    throw new Error(`Manifest validation failed:\n${message}`);
  }
}

function ensureDistArtifacts(distDir, files) {
  const missing = files.filter((file) => {
    try {
      accessSync(join(distDir, file), constants.F_OK);
      return false;
    } catch (_error) {
      return true;
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing build artifacts: ${missing.join(', ')}`);
  }
}

async function main() {
  try {
    const root = resolve(process.cwd());
    const manifestPath = join(root, 'extension', 'manifest.json');
    const schemaPath = join(root, 'extension', 'manifest.schema.json');
    const distDir = join(root, 'dist');

    validateManifest(manifestPath, schemaPath);
    ensureDistArtifacts(distDir, ['sw.js', 'popup.js', 'options.js']);

    console.info('Manifest and build artifacts are valid.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

await main();
