import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { ImageFilesApi, OpenOutputInput, WritePngInput } from '../shared/ipc';

const imageFiles: ImageFilesApi = {
  select: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_FILES.SELECT),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  readPaths: (paths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_FILES.READ_PATHS, paths),
  writePng: (input: WritePngInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_FILES.WRITE_PNG, input),
  openOutput: (input: OpenOutputInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMAGE_FILES.OPEN_OUTPUT, input),
};

contextBridge.exposeInMainWorld('api', {
  imageFiles,
});
