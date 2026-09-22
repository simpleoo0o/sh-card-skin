// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AssetError,
  createAssetHandle,
  sanitizeSvg,
  validateImageFile,
} from './assets';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateImageFile', () => {
  it('accepts a non-empty raster photo', () => {
    expect(() => validateImageFile({ name: 'portrait.jpg', size: 42, type: 'image/jpeg' }, 'photo')).not.toThrow();
  });

  it('rejects an empty file', () => {
    expect(() => validateImageFile({ name: 'empty.png', size: 0, type: 'image/png' }, 'photo'))
      .toThrowError(new AssetError('图片文件是空的'));
  });

  it('allows SVG only for logos', () => {
    const svg = { name: 'logo.svg', size: 42, type: 'image/svg+xml' };
    expect(() => validateImageFile(svg, 'logo')).not.toThrow();
    expect(() => validateImageFile(svg, 'photo')).toThrow('照片仅支持 JPG、PNG 或 WebP');
  });
});

describe('sanitizeSvg', () => {
  it('keeps a self-contained SVG', () => {
    const result = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" /></defs><circle fill="url(#g)" /></svg>');
    expect(result).toContain('<svg');
    expect(result).toContain('<circle');
  });

  it.each([
    ['script', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject /></svg>'],
    ['event attribute', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" />'],
  ])('rejects %s content', (_name, svg) => {
    expect(() => sanitizeSvg(svg)).toThrow('SVG 包含不安全内容');
  });

  it('rejects external href resources', () => {
    expect(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" /></svg>'))
      .toThrow('SVG 不能引用外部资源');
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:url(https://example.com/a.svg)}</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://example.com/a.svg)" /></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/theme.css";</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.x{fill:url("https://example.com/logo file.svg#paint")}</style></svg>',
  ])('rejects external CSS URLs', (svg) => {
    expect(() => sanitizeSvg(svg)).toThrow('SVG 不能引用外部资源');
  });
});

it('revokes an asset object URL at most once', async () => {
  const createObjectURL = vi.fn(() => 'blob:test');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  const file = new File(['raster'], 'logo.png', { type: 'image/png' });

  const handle = await createAssetHandle(file, 'logo');
  handle.revoke();
  handle.revoke();

  expect(handle.url).toBe('blob:test');
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledOnce();
});
