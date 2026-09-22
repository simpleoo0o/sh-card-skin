import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const SOURCE_URL = 'https://www.sptcc.com/img/logo.png';
const SCREENSHOT_SIZE = { width: 1280, height: 720 };
const LOGO_RECT = { x: 504, y: 338, width: 272, height: 45 };
const MARK_RECT = { x: 0, y: 0, width: 60, height: 45 };

export function removeFlatBackground(source, tolerance) {
  const result = new PNG({ width: source.width, height: source.height });
  source.data.copy(result.data);
  const [red, green, blue] = source.data;

  for (let offset = 0; offset < result.data.length; offset += 4) {
    if (
      Math.abs(result.data[offset] - red) <= tolerance
      && Math.abs(result.data[offset + 1] - green) <= tolerance
      && Math.abs(result.data[offset + 2] - blue) <= tolerance
    ) {
      result.data[offset + 3] = 0;
    }
  }

  return result;
}

export function cropPng(source, rect) {
  const result = new PNG({ width: rect.width, height: rect.height });
  PNG.bitblt(source, result, rect.x, rect.y, rect.width, rect.height, 0, 0);
  return result;
}

export function extractLogoFromJpeg(buffer, expectedSize, rect) {
  const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
  if (decoded.width !== expectedSize.width || decoded.height !== expectedSize.height) {
    throw new Error(`Logo 页面截图尺寸已变化：${decoded.width} × ${decoded.height}`);
  }
  const screenshot = new PNG({ width: decoded.width, height: decoded.height });
  screenshot.data.set(decoded.data);
  return cropPng(screenshot, rect);
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const screenshot = await readFile(path.join(scriptDirectory, 'assets/sptcc-logo-page.jpg'));
  const source = extractLogoFromJpeg(screenshot, SCREENSHOT_SIZE, LOGO_RECT);
  const full = removeFlatBackground(source, 12);
  const mark = cropPng(full, MARK_RECT);
  const outputDirectory = path.resolve(scriptDirectory, '../public/logos');
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'sptcc-full.png'), PNG.sync.write(full)),
    writeFile(path.join(outputDirectory, 'sptcc-mark.png'), PNG.sync.write(mark)),
  ]);

  console.log(`${SOURCE_URL} -> ${full.width} × ${full.height}, ${mark.width} × ${mark.height}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
