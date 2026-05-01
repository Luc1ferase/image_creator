export const IPC_CHANNELS = {
  IMAGE_FILES: {
    SELECT: 'image-files:select',
    READ_PATHS: 'image-files:read-paths',
    WRITE_PNG: 'image-files:write-png',
    OPEN_OUTPUT: 'image-files:open-output',
  },
} as const;

export type SelectedImageFile = {
  id: string;
  name: string;
  path: string;
  dataUrl: string;
};

export type SelectImagesResult =
  | {
      success: true;
      files: SelectedImageFile[];
    }
  | {
      success: false;
      error: string;
    };

export type WritePngInput = {
  sourcePath: string;
  folderName: string;
  fileName: string;
  dataUrl: string;
};

export type WritePngResult =
  | {
      success: true;
      outputPath: string;
      outputDirectory: string;
    }
  | {
      success: false;
      error: string;
    };

export type OpenOutputInput = {
  directoryPath: string;
};

export type OpenOutputResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export type ImageFilesApi = {
  select: () => Promise<SelectImagesResult>;
  getPathForFile: (file: File) => string;
  readPaths: (paths: string[]) => Promise<SelectImagesResult>;
  writePng: (input: WritePngInput) => Promise<WritePngResult>;
  openOutput: (input: OpenOutputInput) => Promise<OpenOutputResult>;
};
