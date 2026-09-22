import { describe, expect, it } from 'vitest';
import {
  applyPhotoConstraint,
  clampLogoScale,
  logoScaleForWidth,
  nextQuarterTurn,
  photoTransformFromObject,
} from './card-editor';

const card = { width: 1536, height: 969 };

describe('photo transform helpers', () => {
  it('resets a portrait photo to the centered cover scale', () => {
    const result = applyPhotoConstraint({
      left: 768,
      top: 484.5,
      scaleX: 0,
      scaleY: 0,
      angle: 0,
      width: 1200,
      height: 2400,
    }, card);

    expect(result).toEqual({ x: 768, y: 484.5, scale: 1.28, angle: 0 });
  });

  it('normalizes repeated quarter turns without accumulating full rotations', () => {
    expect(nextQuarterTurn(350, 1)).toBe(80);
    expect(nextQuarterTurn(nextQuarterTurn(350, 1), 1)).toBe(170);
    expect(nextQuarterTurn(10, -1)).toBe(280);
  });

  it('raises a photo scale below the rotated cover minimum', () => {
    const result = applyPhotoConstraint({
      left: 768,
      top: 484.5,
      scaleX: 0.01,
      scaleY: 0.01,
      angle: 45,
      width: 1200,
      height: 2400,
    }, card);

    expect(result.scale).toBeGreaterThan(0.7);
  });

  it('clamps a huge drag while preserving a valid uniform scale', () => {
    const result = applyPhotoConstraint({
      left: 9000,
      top: -9000,
      scaleX: 2,
      scaleY: 2,
      angle: 45,
      width: 1200,
      height: 2400,
    }, card);

    expect(result.x).toBeLessThan(9000);
    expect(result.y).toBeGreaterThan(-9000);
    expect(result.scale).toBe(2);
  });

  it('reads nullable Fabric values into a complete transform', () => {
    expect(photoTransformFromObject({ left: 10, top: 20, scaleX: 1.5, angle: 450 }))
      .toEqual({ x: 10, y: 20, scale: 1.5, angle: 90 });
  });
});

describe('logo transform helpers', () => {
  it('uses 28 percent of the card width for a Logo reset', () => {
    expect(logoScaleForWidth({ width: 272, height: 45 }, 1536))
      .toBeCloseTo(430.08 / 272, 6);
  });

  it('prevents a negative or zero Logo scale', () => {
    expect(clampLogoScale(-2)).toBe(0.05);
    expect(clampLogoScale(0)).toBe(0.05);
    expect(clampLogoScale(9)).toBe(8);
  });
});
