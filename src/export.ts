export interface ExportCanvas<T = object> {
  getActiveObject(): T | undefined;
  discardActiveObject(): unknown;
  requestRenderAll(): void;
  toDataURL(options: {
    format: 'png';
    multiplier: 1;
    enableRetinaScaling: false;
  }): string;
  setActiveObject(object: T): unknown;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function makeExportFilename(now = new Date()): string {
  return `card-skin-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

export function exportCanvasPng<T>(canvas: ExportCanvas<T>): string {
  const selected = canvas.getActiveObject();
  try {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return canvas.toDataURL({
      format: 'png',
      multiplier: 1,
      enableRetinaScaling: false,
    });
  } finally {
    if (selected) canvas.setActiveObject(selected);
    canvas.requestRenderAll();
  }
}
