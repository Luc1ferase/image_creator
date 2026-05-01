export type AssetName = 'banner' | 'avatar' | 'portrait' | 'thumb';

export type Size = {
  width: number;
  height: number;
};

export type CropBox = Size & {
  x: number;
  y: number;
};

export type AssetSpec = {
  name: AssetName;
  label: string;
  defaultSize: Size | null;
  outputFileName: `${AssetName}.png`;
};

export type AssetCompletion = Record<AssetName, boolean>;

export const ASSET_SPECS: AssetSpec[] = [
  {
    name: 'banner',
    label: 'banner',
    defaultSize: null,
    outputFileName: 'banner.png',
  },
  {
    name: 'avatar',
    label: 'avatar',
    defaultSize: { width: 512, height: 512 },
    outputFileName: 'avatar.png',
  },
  {
    name: 'portrait',
    label: 'portrait',
    defaultSize: { width: 512, height: 768 },
    outputFileName: 'portrait.png',
  },
  {
    name: 'thumb',
    label: 'thumb',
    defaultSize: { width: 400, height: 380 },
    outputFileName: 'thumb.png',
  },
];

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const TRAILING_SEPARATORS = /[_. ]+$/g;

export function sanitizeFolderName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.\\/]+$/, '');
  const cleaned = baseName
    .trim()
    .replace(INVALID_FOLDER_CHARS, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(TRAILING_SEPARATORS, '');

  return cleaned.length > 0 ? cleaned : 'image';
}

export function createDefaultCompletion(): AssetCompletion {
  return {
    banner: false,
    avatar: false,
    portrait: false,
    thumb: false,
  };
}

export function getNextPendingAsset(completion: AssetCompletion): AssetName | null {
  const nextSpec = ASSET_SPECS.find((asset) => !completion[asset.name]);
  return nextSpec?.name ?? null;
}

export function getAssetSpec(assetName: AssetName): AssetSpec {
  const spec = ASSET_SPECS.find((asset) => asset.name === assetName);
  if (!spec) {
    throw new Error(`Unknown asset: ${assetName}`);
  }
  return spec;
}

export function createDefaultCrop(imageSize: Size, defaultSize: Size): CropBox {
  const width = Math.min(defaultSize.width, imageSize.width);
  const height = Math.min(defaultSize.height, imageSize.height);

  return {
    x: Math.round((imageSize.width - width) / 2),
    y: Math.round((imageSize.height - height) / 2),
    width,
    height,
  };
}

export function clampCrop(crop: CropBox, imageSize: Size, minimumSize = 32): CropBox {
  const width = Math.min(Math.max(crop.width, minimumSize), imageSize.width);
  const height = Math.min(Math.max(crop.height, minimumSize), imageSize.height);
  const x = Math.min(Math.max(crop.x, 0), imageSize.width - width);
  const y = Math.min(Math.max(crop.y, 0), imageSize.height - height);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function fitSizeWithinBounds(imageSize: Size, bounds: Size): Size {
  if (imageSize.width <= 0 || imageSize.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = Math.min(bounds.width / imageSize.width, bounds.height / imageSize.height);
  return {
    width: imageSize.width * scale,
    height: imageSize.height * scale,
  };
}
