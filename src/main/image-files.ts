import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  OpenOutputInput,
  OpenOutputResult,
  SelectImagesResult,
  SelectedImageFile,
  WritePngInput,
  WritePngResult,
} from '../shared/ipc';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

export function registerImageFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMAGE_FILES.SELECT, selectImages);
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_FILES.READ_PATHS,
    async (_event, paths: string[]): Promise<SelectImagesResult> => readImagePaths(paths)
  );
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_FILES.WRITE_PNG,
    async (_event, input: WritePngInput): Promise<WritePngResult> => writePng(input)
  );
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_FILES.OPEN_OUTPUT,
    async (_event, input: OpenOutputInput): Promise<OpenOutputResult> => openOutput(input)
  );
}

async function selectImages(): Promise<SelectImagesResult> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    if (result.canceled) {
      return { success: true, files: [] };
    }

    const files = await Promise.all(result.filePaths.map(readImageFile));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function readImagePaths(filePaths: string[]): Promise<SelectImagesResult> {
  try {
    const imagePaths = filePaths.filter((filePath) => {
      const extension = path.extname(filePath).replace('.', '').toLowerCase();
      return IMAGE_EXTENSIONS.includes(extension);
    });
    const files = await Promise.all(imagePaths.map(readImageFile));
    return { success: true, files };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function readImageFile(filePath: string): Promise<SelectedImageFile> {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension || 'png'}`;

  return {
    id: `${filePath}-${buffer.byteLength}`,
    name: path.basename(filePath),
    path: filePath,
    dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
  };
}

async function writePng(input: WritePngInput): Promise<WritePngResult> {
  try {
    const sourceDirectory = path.dirname(input.sourcePath);
    const outputDirectory = path.join(sourceDirectory, input.folderName);
    const outputPath = path.join(outputDirectory, input.fileName);
    const base64Payload = input.dataUrl.split(',')[1];

    if (!base64Payload) {
      return { success: false, error: 'Invalid PNG data.' };
    }

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, Buffer.from(base64Payload, 'base64'));

    return { success: true, outputPath, outputDirectory };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function openOutput(input: OpenOutputInput): Promise<OpenOutputResult> {
  try {
    await shell.openPath(input.directoryPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown file operation error.';
}
