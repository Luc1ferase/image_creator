import type { ImageFilesApi } from '@shared/ipc';

declare global {
  interface Window {
    api: {
      imageFiles: ImageFilesApi;
    };
  }
}

export {};
