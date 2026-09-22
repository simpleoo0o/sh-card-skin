import { describe, expect, it } from 'vitest';
import {
  clampPhotoCenter,
  minimumCoverScale,
  normalizeAngle,
  type Size,
} from './geometry';

const card: Size = { width: 1536, height: 969 };

describe('minimumCoverScale', () => {
  it.each([
    [{ width: 3000, height: 2000 }, 0, 0.512],
    [{ width: 1200, height: 2400 }, 0, 1.28],
    [{ width: 1200, height: 2400 }, 90, 0.8075],
  ] satisfies Array<[Size, number, number]>)('covers %o at %d degrees', (image, angle, expected) => {
    expect(minimumCoverScale(image, card, angle)).toBeCloseTo(expected, 4);
  });

  it('covers all four corners at an arbitrary angle', () => {
    const scale = minimumCoverScale({ width: 4000, height: 500 }, card, 45);
    expect(scale).toBeCloseTo((1536 * Math.SQRT1_2 + 969 * Math.SQRT1_2) / 500, 6);
  });

  it('rejects empty image dimensions', () => {
    expect(() => minimumCoverScale({ width: 0, height: 500 }, card, 0)).toThrow('图片尺寸必须大于 0');
  });
});

describe('clampPhotoCenter', () => {
  it('clamps a large drag to the feasible interval in rotated coordinates', () => {
    const image = { width: 1200, height: 2400 };
    const scale = minimumCoverScale(image, card, 45) * 1.5;
    const result = clampPhotoCenter({ x: 4000, y: -3000 }, image, card, scale, 45);
    expect(result.x).toBeLessThan(4000);
    expect(result.y).toBeGreaterThan(-3000);
  });
});

it('normalizes angles without accumulating full turns', () => {
  expect(normalizeAngle(359 + 90)).toBe(89);
  expect(normalizeAngle(-90)).toBe(270);
});
