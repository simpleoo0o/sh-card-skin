export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PhotoTransform extends Point {
  scale: number;
  angle: number;
}

const radians = (degrees: number) => degrees * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function minimumCoverScale(image: Size, canvas: Size, angle: number): number {
  if (image.width <= 0 || image.height <= 0) {
    throw new RangeError('图片尺寸必须大于 0');
  }

  const theta = radians(angle);
  const cosine = Math.abs(Math.cos(theta));
  const sine = Math.abs(Math.sin(theta));

  return Math.max(
    (cosine * canvas.width + sine * canvas.height) / image.width,
    (sine * canvas.width + cosine * canvas.height) / image.height,
  );
}

export function clampPhotoCenter(
  center: Point,
  image: Size,
  canvas: Size,
  scale: number,
  angle: number,
): Point {
  const theta = radians(angle);
  const cosine = Math.cos(theta);
  const sine = Math.sin(theta);
  const corners = [
    { x: -canvas.width / 2, y: -canvas.height / 2 },
    { x: canvas.width / 2, y: -canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: -canvas.width / 2, y: canvas.height / 2 },
  ].map(({ x, y }) => ({
    x: cosine * x + sine * y,
    y: -sine * x + cosine * y,
  }));
  const halfWidth = image.width * scale / 2;
  const halfHeight = image.height * scale / 2;
  const local = {
    x: cosine * (center.x - canvas.width / 2) + sine * (center.y - canvas.height / 2),
    y: -sine * (center.x - canvas.width / 2) + cosine * (center.y - canvas.height / 2),
  };
  const x = clamp(
    local.x,
    Math.max(...corners.map((point) => point.x - halfWidth)),
    Math.min(...corners.map((point) => point.x + halfWidth)),
  );
  const y = clamp(
    local.y,
    Math.max(...corners.map((point) => point.y - halfHeight)),
    Math.min(...corners.map((point) => point.y + halfHeight)),
  );

  return {
    x: canvas.width / 2 + cosine * x - sine * y,
    y: canvas.height / 2 + sine * x + cosine * y,
  };
}

export function constrainPhotoTransform(
  transform: PhotoTransform,
  image: Size,
  canvas: Size,
): PhotoTransform {
  const angle = normalizeAngle(transform.angle);
  const scale = Math.max(transform.scale, minimumCoverScale(image, canvas, angle));
  return {
    ...clampPhotoCenter(transform, image, canvas, scale, angle),
    scale,
    angle,
  };
}
