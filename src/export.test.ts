import { describe, expect, it } from 'vitest';
import { exportCanvasPng, makeExportFilename, type ExportCanvas } from './export';

class TestCanvas implements ExportCanvas {
  selected: object | undefined = { id: 'logo' };
  calls: string[] = [];
  options: unknown;
  error: Error | null = null;

  getActiveObject() {
    this.calls.push('get');
    return this.selected;
  }

  discardActiveObject() {
    this.calls.push('discard');
    this.selected = undefined;
    return this;
  }

  requestRenderAll() {
    this.calls.push('render');
  }

  toDataURL(options: unknown) {
    this.calls.push('export');
    this.options = options;
    if (this.error) throw this.error;
    return 'data:image/png;base64,card';
  }

  setActiveObject(selected: object) {
    this.calls.push('restore');
    this.selected = selected;
    return this;
  }
}

it('formats an export filename from local date components', () => {
  expect(makeExportFilename(new Date('2026-09-22T08:09:07')))
    .toBe('card-skin-20260922-080907.png');
});

describe('exportCanvasPng', () => {
  it('exports without controls and restores the prior selection', () => {
    const canvas = new TestCanvas();
    const selected = canvas.selected;

    expect(exportCanvasPng(canvas)).toBe('data:image/png;base64,card');
    expect(canvas.options).toEqual({
      format: 'png',
      multiplier: 1,
      enableRetinaScaling: false,
    });
    expect(canvas.calls).toEqual(['get', 'discard', 'render', 'export', 'restore', 'render']);
    expect(canvas.selected).toBe(selected);
  });

  it('restores the prior selection when PNG generation throws', () => {
    const canvas = new TestCanvas();
    const selected = canvas.selected;
    canvas.error = new Error('canvas failed');

    expect(() => exportCanvasPng(canvas)).toThrow('canvas failed');
    expect(canvas.calls).toEqual(['get', 'discard', 'render', 'export', 'restore', 'render']);
    expect(canvas.selected).toBe(selected);
  });
});
