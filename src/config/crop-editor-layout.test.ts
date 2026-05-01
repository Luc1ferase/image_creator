import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(__dirname, '../../', relativePath), 'utf8');
}

function readCssBlock(selector: string): string {
  const cssSource = readSource('src/renderer/src/styles/index.css');
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(cssSource);

  assert.ok(match, `${selector} block should exist`);
  return match[1];
}

describe('crop editor large image layout', () => {
  it('renders the image inside a bounded viewport that does not affect stage sizing', () => {
    const appSource = readSource('src/renderer/src/App.tsx');
    assert.match(appSource, /className="crop-stage__image-frame"/);

    const stageBlock = readCssBlock('.crop-stage');
    assert.match(stageBlock, /width:\s*100%/);
    assert.match(stageBlock, /height:\s*100%/);
    assert.match(stageBlock, /min-width:\s*0/);
    assert.match(stageBlock, /min-height:\s*0/);

    const frameBlock = readCssBlock('.crop-stage__image-frame');
    assert.match(frameBlock, /position:\s*absolute/);
    assert.match(frameBlock, /inset:\s*0/);
    assert.match(frameBlock, /overflow:\s*hidden/);
  });

  it('keeps the img element box equal to the fitted bitmap for crop coordinate mapping', () => {
    const imageBlock = readCssBlock('.crop-stage__image');

    assert.match(imageBlock, /max-width:\s*100%/);
    assert.match(imageBlock, /max-height:\s*100%/);
    assert.match(imageBlock, /width:\s*auto/);
    assert.match(imageBlock, /height:\s*auto/);
  });
});
