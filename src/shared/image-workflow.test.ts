import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASSET_SPECS,
  clampCrop,
  createDefaultCrop,
  getNextPendingAsset,
  sanitizeFolderName,
} from './image-workflow';

describe('image workflow helpers', () => {
  it('sanitizes source image names for output folders', () => {
    assert.equal(sanitizeFolderName(' Hero:Card?.jpg '), 'Hero_Card');
    assert.equal(sanitizeFolderName('...'), 'image');
  });

  it('keeps the required asset order and default crop sizes', () => {
    assert.deepEqual(ASSET_SPECS.map((asset) => asset.name), [
      'banner',
      'avatar',
      'portrait',
      'thumb',
    ]);
    assert.deepEqual(ASSET_SPECS.find((asset) => asset.name === 'avatar')?.defaultSize, {
      width: 512,
      height: 512,
    });
    assert.deepEqual(ASSET_SPECS.find((asset) => asset.name === 'portrait')?.defaultSize, {
      width: 512,
      height: 768,
    });
    assert.deepEqual(ASSET_SPECS.find((asset) => asset.name === 'thumb')?.defaultSize, {
      width: 400,
      height: 380,
    });
  });

  it('creates centered default crop boxes that fit inside the image', () => {
    assert.deepEqual(
      createDefaultCrop({ width: 1024, height: 1024 }, { width: 512, height: 512 }),
      {
        x: 256,
        y: 256,
        width: 512,
        height: 512,
      }
    );

    assert.deepEqual(
      createDefaultCrop({ width: 300, height: 260 }, { width: 512, height: 512 }),
      {
        x: 0,
        y: 0,
        width: 300,
        height: 260,
      }
    );
  });

  it('clamps crop boxes to image bounds and minimum size', () => {
    assert.deepEqual(
      clampCrop(
        { x: -10, y: 40, width: 30, height: 900 },
        { width: 500, height: 400 },
        64
      ),
      {
        x: 0,
        y: 0,
        width: 64,
        height: 400,
      }
    );
  });

  it('returns the first pending asset after banner', () => {
    assert.equal(
      getNextPendingAsset({ banner: true, avatar: false, portrait: false, thumb: false }),
      'avatar'
    );
    assert.equal(
      getNextPendingAsset({ banner: true, avatar: true, portrait: true, thumb: true }),
      null
    );
  });
});
