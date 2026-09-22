import { describe, expect, it } from 'vitest';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { cropPng, extractLogoFromJpeg, removeFlatBackground } from './prepare-sptcc-logo.mjs';

function samplePng() {
  const image = new PNG({ width: 2, height: 1 });
  image.data.set([
    180, 180, 180, 255,
    0, 220, 80, 255,
  ]);
  return image;
}

describe('removeFlatBackground', () => {
  it('makes pixels matching the top-left color transparent', () => {
    const result = removeFlatBackground(samplePng(), 6);
    expect(result.data[3]).toBe(0);
    expect(result.data[7]).toBe(255);
  });
});

describe('cropPng', () => {
  it('copies the requested rectangle into a new image', () => {
    const result = cropPng(samplePng(), { x: 1, y: 0, width: 1, height: 1 });
    expect([result.width, result.height]).toEqual([1, 1]);
    expect([...result.data]).toEqual([0, 220, 80, 255]);
  });
});

describe('extractLogoFromJpeg', () => {
  it('decodes a page screenshot and crops the known logo rectangle', () => {
    const source = {
      width: 3,
      height: 2,
      data: Buffer.from([
        0, 0, 0, 255, 10, 20, 30, 255, 0, 0, 0, 255,
        0, 0, 0, 255, 40, 50, 60, 255, 0, 0, 0, 255,
      ]),
    };
    const encoded = jpeg.encode(source, 100).data;
    const result = extractLogoFromJpeg(encoded, { width: 3, height: 2 }, { x: 1, y: 0, width: 1, height: 2 });
    expect([result.width, result.height]).toEqual([1, 2]);
    expect(result.data[3]).toBe(255);
    expect(result.data[7]).toBe(255);
  });
});
