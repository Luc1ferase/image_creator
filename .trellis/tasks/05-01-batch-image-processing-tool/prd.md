# Batch Image Processing Tool

## Goal

Build a desktop image processing tool that accepts multiple images and exports `banner.png`, `avatar.png`, `portrait.png`, and `thumb.png` into per-image folders.

## Requirements

- Users can drag in or upload multiple image files.
- The right side shows a vertical image list.
- The column left of that list shows four vertical processing slots: `banner`, `avatar`, `portrait`, `thumb`.
- The main left workspace shows the current image and an adjustable selection box.
- Processing order is `banner -> avatar -> portrait -> thumb`.
- `banner.png` is exported from the full selected main image.
- `avatar.png` uses a default `512x512` crop box.
- `portrait.png` uses a default `512x768` crop box.
- `thumb.png` uses a default `400x380` crop box.
- Users can drag and resize the crop box before pressing `选定`.
- Each source image gets an output folder named after the source image.
- After `thumb.png` is exported, the app advances to the next image.

## Acceptance Criteria

- [ ] Multiple images can be added through drag-and-drop or file picker.
- [ ] The selected image is exported as `banner.png`.
- [ ] Crops are exported in the required order and filenames.
- [ ] Crop boxes default to the requested dimensions and can be adjusted.
- [ ] Output folders are created automatically.
- [ ] The UI advances to the next image after all four assets are complete.
- [ ] Typecheck, tests, and build pass.

## Technical Notes

- Use Electron IPC for file system writes.
- Use renderer canvas APIs for PNG encoding.
- Do not use renderer Node APIs directly.
- Keep crop workflow helpers in shared pure TypeScript for test coverage.
