import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  ASSET_SPECS,
  clampCrop,
  createDefaultCompletion,
  createDefaultCrop,
  fitSizeWithinBounds,
  getAssetSpec,
  getNextPendingAsset,
  sanitizeFolderName,
} from '@shared/image-workflow';
import type { AssetCompletion, AssetName, CropBox, Size } from '@shared/image-workflow';
import type { SelectedImageFile } from '@shared/ipc';

type QueueImage = SelectedImageFile & {
  outputDirectory: string | null;
  completion: AssetCompletion;
  previews: Partial<Record<AssetName, string>>;
};

type DragMode = 'move' | 'resize';

type PointerState = {
  pointerId: number;
  mode: DragMode;
  startX: number;
  startY: number;
  startCrop: CropBox;
};

type DisplayMetrics = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
};

const MIN_CROP_SIZE = 64;

export function App(): ReactElement {
  const [images, setImages] = useState<QueueImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [activeAsset, setActiveAsset] = useState<AssetName>('banner');
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [displaySize, setDisplaySize] = useState<Size | null>(null);
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState<DisplayMetrics | null>(null);
  const [statusText, setStatusText] = useState('拖入图片或点击上传开始处理');
  const [isExporting, setIsExporting] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerState | null>(null);

  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? null,
    [activeImageId, images]
  );

  const activeSpec = useMemo(() => getAssetSpec(activeAsset), [activeAsset]);

  const updateDisplayMetrics = useCallback((nextImageSize: Size): void => {
    const stage = stageRef.current;
    if (!stage) {
      setDisplayMetrics(null);
      setDisplaySize(null);
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const bounds = {
      width: Math.max(stageRect.width - 2, 0),
      height: Math.max(stageRect.height - 2, 0),
    };
    const nextDisplaySize = fitSizeWithinBounds(nextImageSize, bounds);
    setDisplayMetrics({
      offsetX: (stageRect.width - nextDisplaySize.width) / 2,
      offsetY: (stageRect.height - nextDisplaySize.height) / 2,
      scaleX: nextDisplaySize.width / nextImageSize.width,
      scaleY: nextDisplaySize.height / nextImageSize.height,
    });
    setDisplaySize(nextDisplaySize);
  }, []);

  const cropStyle = useMemo(() => {
    if (!crop || !displayMetrics) {
      return undefined;
    }

    return {
      left: displayMetrics.offsetX + crop.x * displayMetrics.scaleX,
      top: displayMetrics.offsetY + crop.y * displayMetrics.scaleY,
      width: crop.width * displayMetrics.scaleX,
      height: crop.height * displayMetrics.scaleY,
    };
  }, [crop, displayMetrics]);

  const imageStyle = useMemo(() => {
    if (!displaySize) {
      return undefined;
    }

    return {
      width: displaySize.width,
      height: displaySize.height,
    };
  }, [displaySize]);

  const resetForImage = useCallback((image: QueueImage | null): void => {
    setImageSize(null);
    setDisplaySize(null);
    setDisplayMetrics(null);
    setCrop(null);
    setActiveAsset(getNextPendingAsset(image?.completion ?? createDefaultCompletion()) ?? 'banner');
  }, []);

  const appendImages = useCallback((files: SelectedImageFile[]): void => {
    if (files.length === 0) {
      return;
    }

    setImages((currentImages) => {
      const existingIds = new Set(currentImages.map((image) => image.id));
      const nextImages = [
        ...currentImages,
        ...files
          .filter((file) => !existingIds.has(file.id))
          .map<QueueImage>((file) => ({
            ...file,
            outputDirectory: null,
            completion: createDefaultCompletion(),
            previews: {},
          })),
      ];

      if (!activeImageId && nextImages.length > 0) {
        setActiveImageId(nextImages[0].id);
      }

      return nextImages;
    });
    setStatusText(`已加入 ${files.length} 张图片`);
  }, [activeImageId]);

  const selectImages = useCallback(async (): Promise<void> => {
    const result = await window.api.imageFiles.select();
    if (result.success === false) {
      setStatusText(result.error);
      return;
    }
    appendImages(result.files);
  }, [appendImages]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
      const filePaths = files
        .map(getDroppedFilePath)
        .filter((filePath): filePath is string => filePath.length > 0);

      if (filePaths.length > 0) {
        const result = await window.api.imageFiles.readPaths(filePaths);
        if (result.success === false) {
          setStatusText(result.error);
          return;
        }
        appendImages(result.files);
        return;
      }

      appendImages(await Promise.all(files.map(readBrowserImageFile)));
    },
    [appendImages]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
  }, []);

  const handleImageLoad = useCallback((): void => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    const nextImageSize = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    setImageSize(nextImageSize);
    updateDisplayMetrics(nextImageSize);

    if (activeSpec.defaultSize) {
      setCrop(createDefaultCrop(nextImageSize, activeSpec.defaultSize));
    } else {
      setCrop({
        x: 0,
        y: 0,
        width: nextImageSize.width,
        height: nextImageSize.height,
      });
    }
  }, [activeSpec.defaultSize, updateDisplayMetrics]);

  const updateActiveImage = useCallback(
    (updater: (image: QueueImage) => QueueImage): void => {
      if (!activeImageId) {
        return;
      }

      setImages((currentImages) =>
        currentImages.map((image) => (image.id === activeImageId ? updater(image) : image))
      );
    },
    [activeImageId]
  );

  const advanceAfterExport = useCallback(
    (updatedImage: QueueImage): void => {
      const nextAsset = getNextPendingAsset(updatedImage.completion);
      if (nextAsset) {
        setActiveAsset(nextAsset);
        const spec = getAssetSpec(nextAsset);
        if (imageSize && spec.defaultSize) {
          setCrop(createDefaultCrop(imageSize, spec.defaultSize));
        }
        return;
      }

      const activeIndex = images.findIndex((image) => image.id === updatedImage.id);
      const nextImage = images.slice(activeIndex + 1).find((image) => getNextPendingAsset(image.completion));
      if (nextImage) {
        setActiveImageId(nextImage.id);
        resetForImage(nextImage);
        setStatusText(`已完成 ${updatedImage.name}，继续处理 ${nextImage.name}`);
        return;
      }

      setStatusText('全部图片处理完成');
    },
    [imageSize, images, resetForImage]
  );

  const exportCurrentAsset = useCallback(async (): Promise<void> => {
    if (!activeImage || !imageSize || !crop || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const dataUrl =
        activeAsset === 'banner'
          ? await renderFullImagePng(activeImage.dataUrl, imageSize)
          : await renderCropPng(activeImage.dataUrl, crop);
      const folderName = sanitizeFolderName(activeImage.name);
      const result = await window.api.imageFiles.writePng({
        sourcePath: activeImage.path,
        folderName,
        fileName: activeSpec.outputFileName,
        dataUrl,
      });

      if (result.success === false) {
        setStatusText(result.error);
        return;
      }

      const nextCompletion = {
        ...activeImage.completion,
        [activeAsset]: true,
      };
      const updatedImage: QueueImage = {
        ...activeImage,
        outputDirectory: result.outputDirectory,
        completion: nextCompletion,
        previews: {
          ...activeImage.previews,
          [activeAsset]: dataUrl,
        },
      };

      updateActiveImage(() => updatedImage);
      setStatusText(`已导出 ${activeSpec.outputFileName}`);
      advanceAfterExport(updatedImage);
    } finally {
      setIsExporting(false);
    }
  }, [
    activeAsset,
    activeImage,
    activeSpec.outputFileName,
    advanceAfterExport,
    crop,
    imageSize,
    isExporting,
    updateActiveImage,
  ]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, mode: DragMode): void => {
      if (!crop) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      pointerRef.current = {
        pointerId: event.pointerId,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startCrop: crop,
      };
    },
    [crop]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const pointer = pointerRef.current;
      if (!pointer || !displayMetrics || !imageSize) {
        return;
      }

      const deltaX = (event.clientX - pointer.startX) / displayMetrics.scaleX;
      const deltaY = (event.clientY - pointer.startY) / displayMetrics.scaleY;
      const nextCrop =
        pointer.mode === 'move'
          ? {
              ...pointer.startCrop,
              x: pointer.startCrop.x + deltaX,
              y: pointer.startCrop.y + deltaY,
            }
          : {
              ...pointer.startCrop,
              width: pointer.startCrop.width + deltaX,
              height: pointer.startCrop.height + deltaY,
            };

      setCrop(clampCrop(nextCrop, imageSize, MIN_CROP_SIZE));
    },
    [displayMetrics, imageSize]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    if (pointerRef.current?.pointerId === event.pointerId) {
      pointerRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetForImage(activeImage);
  }, [activeImage?.id, resetForImage]);

  useEffect(() => {
    const image = imageRef.current;
    if (!activeImage || !image || !image.complete || image.naturalWidth === 0) {
      return;
    }

    handleImageLoad();
  }, [activeImage, handleImageLoad]);

  useEffect(() => {
    if (!imageSize) {
      return undefined;
    }

    const handleResize = (): void => updateDisplayMetrics(imageSize);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageSize, updateDisplayMetrics]);

  return (
    <main className="app-shell" onDrop={handleDrop} onDragOver={handleDragOver}>
      <section className="workspace">
        <header className="workspace__header">
          <div>
            <h1>Image Creator</h1>
            <p>{statusText}</p>
          </div>
          <div className="workspace__actions">
            <button className="button button--secondary" type="button" onClick={selectImages}>
              上传图片
            </button>
            <button
              className="button"
              type="button"
              disabled={!activeImage || !imageSize || !crop || isExporting}
              onClick={() => void exportCurrentAsset()}
            >
              选定
            </button>
          </div>
        </header>

        <div className="crop-stage" ref={stageRef}>
          {activeImage ? (
            <>
              <div className="crop-stage__image-frame">
                <img
                  ref={imageRef}
                  className="crop-stage__image"
                  src={activeImage.dataUrl}
                  alt={activeImage.name}
                  style={imageStyle}
                  onLoad={handleImageLoad}
                />
              </div>
              {cropStyle && activeAsset !== 'banner' ? (
                <div
                  className="crop-box"
                  style={cropStyle}
                  onPointerDown={(event) => handlePointerDown(event, 'move')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <span className="crop-box__label">
                    {Math.round(crop?.width ?? 0)} x {Math.round(crop?.height ?? 0)}
                  </span>
                  <button
                    className="crop-box__handle"
                    type="button"
                    aria-label="Resize crop"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handlePointerDown(event, 'resize');
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                </div>
              ) : null}
              {activeAsset === 'banner' ? (
                <div className="crop-stage__banner-note">banner 将按完整主图导出</div>
              ) : null}
            </>
          ) : (
            <div className="drop-empty">
              <strong>拖入图片</strong>
              <span>支持一次添加多张图片进行批量处理</span>
            </div>
          )}
        </div>
      </section>

      <aside className="slots-panel">
        {ASSET_SPECS.map((asset) => {
          const preview = activeImage?.previews[asset.name];
          const isCurrent = activeAsset === asset.name;
          const isDone = activeImage?.completion[asset.name] === true;

          return (
            <div
              className={[
                'slot-card',
                isCurrent ? 'slot-card--active' : '',
                isDone ? 'slot-card--done' : '',
              ].join(' ')}
              key={asset.name}
            >
              <div className="slot-card__preview">
                {preview ? <img src={preview} alt={`${asset.label} preview`} /> : <span />}
              </div>
              <div className="slot-card__name">{asset.label}</div>
            </div>
          );
        })}
        {activeImage?.outputDirectory ? (
          <button
            className="slots-panel__open"
            type="button"
            onClick={() =>
              void window.api.imageFiles.openOutput({
                directoryPath: activeImage.outputDirectory ?? '',
              })
            }
          >
            打开目录
          </button>
        ) : null}
      </aside>

      <aside className="image-list">
        {images.map((image, index) => {
          const isActive = image.id === activeImageId;
          const isComplete = getNextPendingAsset(image.completion) === null;
          return (
            <button
              className={[
                'image-list__item',
                isActive ? 'image-list__item--active' : '',
                isComplete ? 'image-list__item--complete' : '',
              ].join(' ')}
              key={image.id}
              type="button"
              onClick={() => setActiveImageId(image.id)}
            >
              <img src={image.dataUrl} alt={image.name} />
              <span>{index + 1}</span>
            </button>
          );
        })}
      </aside>
    </main>
  );
}

async function readBrowserImageFile(file: File): Promise<SelectedImageFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    path: file.name,
    dataUrl,
  };
}

async function renderFullImagePng(dataUrl: string, imageSize: Size): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = imageSize.width;
  canvas.height = imageSize.height;
  const context = getCanvasContext(canvas);
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

async function renderCropPng(dataUrl: string, crop: CropBox): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const context = getCanvasContext(canvas);
  context.drawImage(
    image,
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/png');
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = dataUrl;
  });
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context is unavailable.');
  }
  return context;
}

function getDroppedFilePath(file: File): string {
  const electronPath = window.api.imageFiles.getPathForFile(file);
  if (electronPath.length > 0) {
    return electronPath;
  }

  const maybeFileWithPath = file as File & { path?: unknown };
  return typeof maybeFileWithPath.path === 'string' ? maybeFileWithPath.path : '';
}
