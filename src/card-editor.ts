import { Canvas, FabricImage, type FabricObject } from 'fabric';
import {
  constrainPhotoTransform,
  normalizeAngle,
  type PhotoTransform,
  type Size,
} from './geometry';

export type LayerName = 'photo' | 'logo';

export interface EditorSnapshot {
  activeLayer: LayerName | null;
  hasPhoto: boolean;
  hasLogo: boolean;
  angle: number;
  scale: number;
}

interface TransformObjectLike {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  width?: number;
  height?: number;
}

const CARD_SIZE = { width: 1536, height: 969 } as const;
const CARD_CENTER = { x: CARD_SIZE.width / 2, y: CARD_SIZE.height / 2 } as const;
const LOGO_SAFE_INSET = 96;

export function photoTransformFromObject(object: TransformObjectLike): PhotoTransform {
  return {
    x: object.left ?? CARD_CENTER.x,
    y: object.top ?? CARD_CENTER.y,
    scale: Math.abs(object.scaleX ?? object.scaleY ?? 1),
    angle: normalizeAngle(object.angle ?? 0),
  };
}

export function applyPhotoConstraint(
  object: TransformObjectLike,
  canvas: Size = CARD_SIZE,
): PhotoTransform {
  return constrainPhotoTransform(
    photoTransformFromObject(object),
    { width: object.width ?? 0, height: object.height ?? 0 },
    canvas,
  );
}

export function logoScaleForWidth(image: Size, canvasWidth: number): number {
  if (image.width <= 0) throw new RangeError('Logo 宽度必须大于 0');
  return canvasWidth * 0.28 / image.width;
}

export function clampLogoScale(scale: number): number {
  return Math.min(8, Math.max(0.05, scale));
}

export function nextQuarterTurn(angle: number, direction: number): number {
  return normalizeAngle(angle + Math.sign(direction) * 90);
}

export class CardEditor {
  private readonly canvas: Canvas;
  private readonly onChange: (state: EditorSnapshot) => void;
  private photo: FabricImage | null = null;
  private logo: FabricImage | null = null;

  constructor(element: HTMLCanvasElement, onChange: (state: EditorSnapshot) => void) {
    this.canvas = new Canvas(element, {
      width: CARD_SIZE.width,
      height: CARD_SIZE.height,
      preserveObjectStacking: true,
      uniformScaling: true,
      selection: false,
    });
    this.onChange = onChange;

    for (const event of ['object:moving', 'object:scaling', 'object:rotating', 'object:modified'] as const) {
      this.canvas.on(event, ({ target }) => {
        if (target === this.photo) this.constrainPhoto();
        if (target === this.logo) this.constrainLogo();
        this.emitChange();
      });
    }
    this.canvas.on('selection:created', () => this.emitChange());
    this.canvas.on('selection:updated', () => this.emitChange());
    this.canvas.on('selection:cleared', () => this.emitChange());
  }

  async setPhoto(url: string): Promise<void> {
    const image = await FabricImage.fromURL(url);
    this.assertDecodedImage(image, '照片');
    image.set({
      originX: 'center',
      originY: 'center',
      lockScalingFlip: true,
      flipX: false,
      flipY: false,
      transparentCorners: false,
      cornerStyle: 'circle',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#0071e3',
      borderColor: '#ffffff',
    });

    const previous = this.photo;
    this.photo = image;
    this.resetPhoto();
    this.canvas.add(image);
    this.canvas.moveObjectTo(image, 0);
    if (previous) this.canvas.remove(previous);
    this.canvas.setActiveObject(image);
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  async setLogo(url: string): Promise<void> {
    const image = await FabricImage.fromURL(url);
    this.assertDecodedImage(image, 'Logo');
    image.set({
      originX: 'center',
      originY: 'center',
      lockScalingFlip: true,
      flipX: false,
      flipY: false,
      transparentCorners: false,
      cornerStyle: 'circle',
      cornerColor: '#ffffff',
      cornerStrokeColor: '#0071e3',
      borderColor: '#ffffff',
    });

    const previous = this.logo;
    this.logo = image;
    this.resetLogo();
    this.canvas.add(image);
    if (previous) this.canvas.remove(previous);
    this.canvas.setActiveObject(image);
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  selectLayer(layer: LayerName): void {
    const object = layer === 'photo' ? this.photo : this.logo;
    if (object) this.canvas.setActiveObject(object);
    else this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  setActiveAngle(angle: number): void {
    const object = this.activeObject();
    if (!object) return;
    object.set('angle', normalizeAngle(angle));
    if (object === this.photo) this.constrainPhoto();
    this.finishTransform(object);
  }

  setActiveScale(scale: number): void {
    const object = this.activeObject();
    if (!object) return;
    const nextScale = object === this.logo ? clampLogoScale(scale) : Math.abs(scale);
    object.scale(nextScale);
    if (object === this.photo) this.constrainPhoto();
    this.finishTransform(object);
  }

  rotateActiveBy(degrees: number): void {
    const object = this.activeObject();
    if (!object) return;
    this.setActiveAngle((object.angle ?? 0) + degrees);
  }

  nudgeActive(dx: number, dy: number): void {
    const object = this.activeObject();
    if (!object) return;
    object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy });
    if (object === this.photo) this.constrainPhoto();
    this.finishTransform(object);
  }

  resetActive(): void {
    const object = this.activeObject();
    if (object === this.photo) this.resetPhoto();
    if (object === this.logo) this.resetLogo();
    if (object) this.finishTransform(object);
  }

  hasPhoto(): boolean {
    return this.photo !== null;
  }

  exportPngDataUrl(): string {
    return this.canvas.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  }

  dispose(): void {
    void this.canvas.dispose();
  }

  private activeObject(): FabricObject | null {
    const object = this.canvas.getActiveObject();
    return object === this.photo || object === this.logo ? object : null;
  }

  private assertDecodedImage(image: FabricImage, label: string): void {
    if (!image.width || !image.height) throw new Error(`${label} 无法解码`);
  }

  private constrainPhoto(): void {
    if (!this.photo) return;
    const transform = applyPhotoConstraint(this.photo, CARD_SIZE);
    this.photo.set({
      left: transform.x,
      top: transform.y,
      scaleX: transform.scale,
      scaleY: transform.scale,
      angle: transform.angle,
      flipX: false,
      flipY: false,
    });
    this.photo.setCoords();
    this.canvas.requestRenderAll();
  }

  private constrainLogo(): void {
    if (!this.logo) return;
    const scale = clampLogoScale(this.logo.scaleX);
    this.logo.set({ scaleX: scale, scaleY: scale, flipX: false, flipY: false });
    this.logo.setCoords();
  }

  private resetPhoto(): void {
    if (!this.photo) return;
    this.photo.set({
      left: CARD_CENTER.x,
      top: CARD_CENTER.y,
      scaleX: 0,
      scaleY: 0,
      angle: 0,
      flipX: false,
      flipY: false,
    });
    this.constrainPhoto();
  }

  private resetLogo(): void {
    if (!this.logo) return;
    const scale = logoScaleForWidth(this.logo, CARD_SIZE.width);
    const scaledWidth = this.logo.width * scale;
    const scaledHeight = this.logo.height * scale;
    this.logo.set({
      left: LOGO_SAFE_INSET + scaledWidth / 2,
      top: CARD_SIZE.height - LOGO_SAFE_INSET - scaledHeight / 2,
      scaleX: scale,
      scaleY: scale,
      angle: 0,
      flipX: false,
      flipY: false,
    });
    this.logo.setCoords();
  }

  private finishTransform(object: FabricObject): void {
    object.setCoords();
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  private emitChange(): void {
    const active = this.activeObject();
    this.onChange({
      activeLayer: active === this.photo ? 'photo' : active === this.logo ? 'logo' : null,
      hasPhoto: this.photo !== null,
      hasLogo: this.logo !== null,
      angle: normalizeAngle(active?.angle ?? 0),
      scale: active ? Math.abs(active.scaleX) : 1,
    });
  }
}
