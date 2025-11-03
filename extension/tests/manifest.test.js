import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(relativePath) {
  const content = readFileSync(join(__dirname, '..', relativePath), 'utf8');
  return JSON.parse(content);
}

describe('manifest', () => {
  it('matches the required schema', () => {
    const manifest = loadJson('manifest.json');
    const schema = loadJson('manifest.schema.json');

    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const isValid = validate(manifest);

    if (!isValid) {
      const message = ajv.errorsText(validate.errors, { separator: '\n' });
      console.error(message);
    }

    expect(isValid).toBe(true);
  });
});
