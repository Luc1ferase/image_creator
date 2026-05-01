import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('vite packaged renderer config', () => {
  it('uses relative asset paths for file protocol packaging', () => {
    const configPath = path.resolve(__dirname, '../../vite.config.mjs');
    const configSource = readFileSync(configPath, 'utf8');

    assert.match(configSource, /base:\s*['"]\.\/['"]/);
  });
});
