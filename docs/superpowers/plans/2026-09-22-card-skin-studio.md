# Card Skin Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个部署在 GitHub Pages、完全在浏览器本地运行的卡面编辑器，可将照片和可变换 Logo 导出为 AirCard 使用的 1536 × 969 PNG。

**Architecture:** Vite + TypeScript 提供无框架静态应用，Fabric.js 管理照片与 Logo 两个画布图层，纯函数模块负责任意旋转角度下的覆盖约束。原生 HTML/CSS 提供 Apple 官网式响应式界面；Vitest 固定几何和文件处理规则，Playwright 覆盖真实浏览器主流程。

**Tech Stack:** Node.js 24、npm、Vite 8、TypeScript 7、Fabric.js 7、Vitest 5、Playwright 1.63、原生 HTML/CSS、GitHub Pages Actions

**Spec:** `docs/superpowers/specs/2026-09-22-card-skin-studio-design.md`

## Global Constraints

- 逻辑画布和导出 PNG 固定为 1536 × 969，sRGB、完整矩形，无预览圆角或编辑控件。
- 用户照片与自定义 Logo 只能停留在当前浏览器内存中，不发送、不持久化。
- 画布只有一个照片图层和至多一个 Logo 图层；新 Logo 替换旧 Logo。
- 照片在任意拖动、缩放和旋转状态下必须完全覆盖卡面，不得露白。
- Logo 支持拖动、缩放、旋转和部分移出画布，但不得翻转或缩放为零。
- 内置 Logo 只从 `https://www.sptcc.com/img/logo.png` 派生，并保留来源说明。
- 视觉采用 Apple 官网式语言但不复制 Apple 专有素材；适配浅色、深色与 `prefers-reduced-motion`。
- Vite `base` 固定为 `/sh-card-skin/`，目标站点为 `https://simpleoo0o.github.io/sh-card-skin/`。
- 支持当前 Chrome、Edge、Safari；桌面和窄屏触控布局均可完成全流程。
- 使用 npm 锁文件；Node.js 最低版本为 22.12.0。

## Review Focus

- 极端宽图、极端高图和 359°/45° 旋转后仍不得露出卡面角点；Task 1 的参数化测试固定此行为。
- 拖动、缩放、旋转事件连续触发时不得出现位置跳变或比例低于最小值；Task 3 的变换测试与 Task 6 的浏览器流程覆盖。
- 损坏图片、空文件和带外部资源的 SVG 必须提示错误，且不能替换当前有效图层；Task 2 测试覆盖。
- 导出成功或失败后都必须恢复用户原来的选中图层，成品不能带选框；Task 4 单元测试和 Task 6 PNG 检查覆盖。
- 深色、浅色和减少动态效果模式下必须可读、可操作，且直接拖动画布对象没有滞后补间；Task 5 初始浏览器测试与 Task 6 模式检查覆盖。

---

## Planned File Structure

```text
.github/workflows/pages.yml          # CI 检查与 Pages 部署
README.md                            # 使用方法、隐私和商标/素材来源
index.html                           # 语义化页面骨架
package.json                         # 脚本与锁定依赖入口
package-lock.json                    # npm 锁文件
playwright.config.ts                 # 真实浏览器测试配置
tsconfig.json                        # 严格 TypeScript 配置
vite.config.ts                       # GitHub Pages 子路径与测试配置
public/logos/sptcc-full.png          # 官方图片去底后的完整标识
public/logos/sptcc-mark.png          # 从同一图片裁出的图形标识
public/logos/SOURCES.md              # 素材来源和确定性处理说明
scripts/prepare-sptcc-logo.mjs       # 可复现的透明化和裁切脚本
src/assets.ts                        # 文件类型、SVG 安全检查和对象 URL 生命周期
src/assets.test.ts                   # 无效文件与 SVG 外链回归测试
src/card-editor.ts                   # Fabric 画布、图层和导出编排
src/export.ts                        # 导出文件名与选择态恢复
src/export.test.ts                   # 导出状态回归测试
src/geometry.ts                      # 照片覆盖、角度和中心点夹取纯函数
src/geometry.test.ts                 # 旋转裁切几何测试
src/main.ts                          # DOM 查询、事件绑定和状态提示
src/styles.css                       # Apple 式响应式视觉和动效
src/vite-env.d.ts                    # Vite 类型声明
tests/editor.spec.ts                 # 上传、编辑、错误、导出的浏览器流程
```

文件边界保持简单：`geometry.ts` 不依赖 DOM 或 Fabric；`assets.ts` 不依赖画布；`card-editor.ts` 是唯一接触 Fabric API 的模块；`main.ts` 只绑定界面。

### Task 1: Project scaffold and photo-cover geometry

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/geometry.ts`
- Create: `src/geometry.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `Size`, `Point`, `PhotoTransform`, `minimumCoverScale()`, `clampPhotoCenter()`, `constrainPhotoTransform()`, `normalizeAngle()`。

- [ ] **Step 1: Add the dependency and compiler configuration**

Create `package.json` with exact scripts and version floors:

```json
{
  "name": "sh-card-skin",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "check": "npm run test:run && npm run build"
  },
  "dependencies": {
    "fabric": "^7.4.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/pngjs": "^6.0.5",
    "pngjs": "^7.0.0",
    "typescript": "^7.0.2",
    "vite": "^8.3.0",
    "vitest": "^5.0.1"
  }
}
```

Create `tsconfig.json` with `target: ES2023`, `moduleResolution: Bundler`, `strict: true`, `noUncheckedIndexedAccess: true`, DOM libraries, and `noEmit: true`. Create `vite.config.ts` with `base: '/sh-card-skin/'` and Vitest include `src/**/*.test.ts`. Add `/// <reference types="vite/client" />` to `src/vite-env.d.ts`.

Run: `npm install`

Expected: `package-lock.json` is created and npm exits 0.

- [ ] **Step 2: Write failing geometry tests**

Create `src/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampPhotoCenter,
  minimumCoverScale,
  normalizeAngle,
  type Point,
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
```

- [ ] **Step 3: Run the geometry test and verify RED**

Run: `npm run test:run -- src/geometry.test.ts`

Expected: FAIL because `src/geometry.ts` does not exist.

- [ ] **Step 4: Implement the minimum geometry module**

Create `src/geometry.ts` with these exact public types and calculations:

```ts
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export interface PhotoTransform extends Point { scale: number; angle: number }

const radians = (degrees: number) => degrees * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function minimumCoverScale(image: Size, canvas: Size, angle: number): number {
  if (image.width <= 0 || image.height <= 0) throw new RangeError('图片尺寸必须大于 0');
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
  ].map(({ x, y }) => ({ x: cosine * x + sine * y, y: -sine * x + cosine * y }));
  const halfWidth = image.width * scale / 2;
  const halfHeight = image.height * scale / 2;
  const local = {
    x: cosine * (center.x - canvas.width / 2) + sine * (center.y - canvas.height / 2),
    y: -sine * (center.x - canvas.width / 2) + cosine * (center.y - canvas.height / 2),
  };
  const x = clamp(local.x, Math.max(...corners.map((p) => p.x - halfWidth)), Math.min(...corners.map((p) => p.x + halfWidth)));
  const y = clamp(local.y, Math.max(...corners.map((p) => p.y - halfHeight)), Math.min(...corners.map((p) => p.y + halfHeight)));
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
  return { ...clampPhotoCenter(transform, image, canvas, scale, angle), scale, angle };
}
```

- [ ] **Step 5: Run focused and full tests**

Run: `npm run test:run -- src/geometry.test.ts`

Expected: PASS.

Run: `npm run test:run`

Expected: all tests PASS.

- [ ] **Step 6: Commit the scaffold and geometry**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts src/vite-env.d.ts src/geometry.ts src/geometry.test.ts
git diff --cached --check
git commit -m "feat: scaffold editor geometry"
```

### Task 2: Safe local assets and reproducible built-in logos

**Files:**
- Create: `src/assets.ts`
- Create: `src/assets.test.ts`
- Create: `scripts/prepare-sptcc-logo.mjs`
- Create: `public/logos/sptcc-full.png`
- Create: `public/logos/sptcc-mark.png`
- Create: `public/logos/SOURCES.md`

**Interfaces:**
- Consumes: browser `File`, `Blob`, `DOMParser`, `URL`.
- Produces: `AssetRole`, `AssetHandle`, `validateImageFile()`, `sanitizeSvg()`, `createAssetHandle()`.

- [ ] **Step 1: Write failing asset validation tests**

Create `src/assets.test.ts` with tests for a valid raster photo, an empty file, SVG rejected as a photo, a safe inline SVG Logo, and SVG containing `script`, `foreignObject`, external `href`, external CSS `url()` or event attributes. Assert invalid input throws `AssetError` and safe SVG retains its root `<svg>`.

The external-reference assertion must include:

```ts
expect(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" /></svg>'))
  .toThrow('SVG 不能引用外部资源');
```

- [ ] **Step 2: Run asset tests and verify RED**

Run: `npm run test:run -- src/assets.test.ts`

Expected: FAIL because `src/assets.ts` does not exist.

- [ ] **Step 3: Implement validation and disposable object URLs**

Implement `src/assets.ts` with:

```ts
export type AssetRole = 'photo' | 'logo';
export interface AssetHandle { url: string; revoke(): void }
export class AssetError extends Error {}

const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file: Pick<File, 'name' | 'size' | 'type'>, role: AssetRole): void {
  if (file.size === 0) throw new AssetError('图片文件是空的');
  if (rasterTypes.has(file.type)) return;
  if (role === 'logo' && file.type === 'image/svg+xml') return;
  throw new AssetError(role === 'photo' ? '照片仅支持 JPG、PNG 或 WebP' : 'Logo 仅支持 PNG、JPG、WebP 或 SVG');
}
```

`sanitizeSvg()` must parse with `DOMParser`, require an `<svg>` document root, reject `parsererror`, `script`, `foreignObject`, any attribute starting with `on`, any non-fragment `href`/`xlink:href`, and any attribute or `<style>` text containing `url(` unless it is `url(#local-id)`. Return `new XMLSerializer().serializeToString(root)`.

`createAssetHandle(file, role)` must validate first; for raster files create one object URL; for SVG read text, sanitize, wrap the result in a new `Blob({ type: 'image/svg+xml' })`, and create an object URL from the sanitized blob. Its `revoke()` is idempotent.

- [ ] **Step 4: Run asset tests and verify GREEN**

Run: `npm run test:run -- src/assets.test.ts`

Expected: PASS, including the external-reference and empty-file cases.

- [ ] **Step 5: Add the deterministic logo preparation script**

Implement `scripts/prepare-sptcc-logo.mjs` using `pngjs`: download only `https://www.sptcc.com/img/logo.png`, verify HTTP 200 and source dimensions 272 × 45, use the top-left pixel as the flat background color, set alpha to 0 when every RGB channel is within tolerance 6 of that color, then write the full 272 × 45 image and crop pixels `x=0..59`, `y=0..44` into a 60 × 45 mark image. Fail instead of writing if source dimensions change.

Run: `node scripts/prepare-sptcc-logo.mjs`

Expected: both PNGs exist; the top-left output pixel has alpha 0; the script prints the source URL and two output dimensions.

Create `public/logos/SOURCES.md` naming the official page, exact image URL, retrieval date 2026-09-22, background tolerance, crop rectangle, and non-affiliation notice.

- [ ] **Step 6: Commit safe assets and logo provenance**

```bash
git add src/assets.ts src/assets.test.ts scripts/prepare-sptcc-logo.mjs public/logos
git diff --cached --check
git commit -m "feat: add safe local image assets"
```

### Task 3: Fabric editor engine and transform controls

**Files:**
- Create: `src/card-editor.ts`
- Create: `src/card-editor.test.ts`

**Interfaces:**
- Consumes: `constrainPhotoTransform()` from `geometry.ts`, object URLs from `assets.ts`, Fabric `Canvas` and `FabricImage`.
- Produces: `CardEditor`, `LayerName`, `EditorSnapshot`, and change/error callbacks used by `main.ts`.

- [ ] **Step 1: Write failing transform-state tests**

Create `src/card-editor.test.ts` around exported pure helpers `photoTransformFromObject()`, `applyPhotoConstraint()`, `logoScaleForWidth()` and `nextQuarterTurn()`. Cover portrait reset, repeated 90° rotation, scale below minimum, huge drag, negative Logo scale, and a Logo default width of 28% of 1536.

Assert:

```ts
expect(nextQuarterTurn(350, 1)).toBe(80);
expect(logoScaleForWidth({ width: 272, height: 45 }, 1536)).toBeCloseTo(430.08 / 272, 6);
```

- [ ] **Step 2: Run editor tests and verify RED**

Run: `npm run test:run -- src/card-editor.test.ts`

Expected: FAIL because `src/card-editor.ts` does not exist.

- [ ] **Step 3: Implement the editor public surface**

Create `CardEditor` with this public API:

```ts
export type LayerName = 'photo' | 'logo';
export interface EditorSnapshot {
  activeLayer: LayerName | null;
  hasPhoto: boolean;
  hasLogo: boolean;
  angle: number;
  scale: number;
}

export class CardEditor {
  constructor(element: HTMLCanvasElement, onChange: (state: EditorSnapshot) => void);
  async setPhoto(url: string): Promise<void>;
  async setLogo(url: string): Promise<void>;
  selectLayer(layer: LayerName): void;
  setActiveAngle(angle: number): void;
  setActiveScale(scale: number): void;
  rotateActiveBy(degrees: number): void;
  nudgeActive(dx: number, dy: number): void;
  resetActive(): void;
  hasPhoto(): boolean;
  exportPngDataUrl(): string;
  dispose(): void;
}
```

Use a 1536 × 969 Fabric canvas with uniform scaling and `preserveObjectStacking: true`. Set the photo origin to center, disable flip, and keep it at stack index 0. Set the Logo origin to center, disable flip, and use transparent-corner controls with a visible high-contrast border.

On photo `moving`, `scaling`, `rotating`, and `modified`, read `left`, `top`, uniform scale and angle, pass them through `constrainPhotoTransform()`, then set the constrained values back before `requestRenderAll()`. Do not call `bringToFront()` on photo selection. Logo scale must clamp to `0.05..8` without positional clamping.

`setPhoto()` and `setLogo()` must await `FabricImage.fromURL(url)`, and only remove the previous object after the new image has loaded and has nonzero dimensions. Photo reset centers at `(768, 484.5)` with angle 0 and minimum cover scale. Logo reset uses 28% card width; its center is `(96 + scaledWidth / 2, 969 - 96 - scaledHeight / 2)` so every edge observes the 96-pixel left/bottom safe inset.

- [ ] **Step 4: Run editor unit tests and verify GREEN**

Run: `npm run test:run -- src/card-editor.test.ts`

Expected: PASS for reset, quarter turn, clamp and default Logo scale.

- [ ] **Step 5: Add a compile-only Fabric integration check**

Run: `npm run build`

Expected: TypeScript accepts the Fabric 7 imports and the production bundle is created. If the installed Fabric signatures differ, adapt only the calls to the installed exported types; keep the public `CardEditor` API unchanged.

- [ ] **Step 6: Commit the editor engine**

```bash
git add src/card-editor.ts src/card-editor.test.ts
git diff --cached --check
git commit -m "feat: add two-layer card editor"
```

### Task 4: Clean PNG export and recoverable state

**Files:**
- Create: `src/export.ts`
- Create: `src/export.test.ts`
- Modify: `src/card-editor.ts`

**Interfaces:**
- Consumes: Fabric canvas methods `getActiveObject()`, `discardActiveObject()`, `setActiveObject()`, `toDataURL()`.
- Produces: `makeExportFilename()`, `exportCanvasPng()`; `CardEditor.exportPngDataUrl()` delegates to the helper.

- [ ] **Step 1: Write failing export tests**

Create a minimal `ExportCanvas` fake and test:

- filename for `new Date('2026-09-22T08:09:07')` is `card-skin-20260922-080907.png` in local time;
- `toDataURL` receives `{ format: 'png', multiplier: 1, enableRetinaScaling: false }`;
- selection is discarded before export and restored afterward;
- selection is restored even when `toDataURL()` throws.

- [ ] **Step 2: Run export tests and verify RED**

Run: `npm run test:run -- src/export.test.ts`

Expected: FAIL because `src/export.ts` does not exist.

- [ ] **Step 3: Implement export helpers with `try/finally`**

Create `makeExportFilename(now = new Date())` with zero-padded local components. Implement `exportCanvasPng(canvas)` as:

```ts
export function exportCanvasPng(canvas: ExportCanvas): string {
  const selected = canvas.getActiveObject();
  try {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return canvas.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  } finally {
    if (selected) canvas.setActiveObject(selected);
    canvas.requestRenderAll();
  }
}
```

Delegate `CardEditor.exportPngDataUrl()` to this helper and throw `Error('请先添加照片')` if no photo exists.

- [ ] **Step 4: Run export and full unit tests**

Run: `npm run test:run -- src/export.test.ts`

Expected: PASS, including thrown-export restoration.

Run: `npm run test:run`

Expected: all unit tests PASS.

- [ ] **Step 5: Commit export behavior**

```bash
git add src/export.ts src/export.test.ts src/card-editor.ts
git diff --cached --check
git commit -m "feat: export clean AirCard PNG files"
```

### Task 5: Accessible Apple-inspired interface

**Files:**
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `CardEditor`, `createAssetHandle()`, `makeExportFilename()` and `/logos/*.png`.
- Produces: the complete user-facing application and stable `data-testid` hooks for Task 6.

- [ ] **Step 1: Write the initial browser test and verify RED**

Create the first part of `tests/editor.spec.ts` asserting that `/sh-card-skin/` contains heading `把喜欢的照片，变成你的卡面`, buttons `选择照片`, `完整标识`, `图形标识`, and a disabled `导出 PNG` button.

Create `playwright.config.ts` with `webServer.command: 'npm run dev -- --host 127.0.0.1 --port 4173'`, URL `http://127.0.0.1:4173/sh-card-skin/`, Chromium and WebKit projects, and no retries locally.

Run: `npx playwright install chromium webkit` once, then `npm run test:e2e -- --grep "initial editor"`.

Expected: FAIL because the page does not exist.

- [ ] **Step 2: Build the semantic page skeleton**

`index.html` must contain:

- a hero with eyebrow `Card Skin Studio`, the required heading, local-only privacy sentence and output badge `1536 × 969 PNG`;
- a main two-column `.studio` region;
- photo upload input `#photo-input` and drop target;
- Logo preset buttons with `data-logo="full"` and `data-logo="mark"`, plus `#logo-input`;
- layer tabs `data-layer="photo"` and `data-layer="logo"`;
- range inputs `#scale-control` and `#angle-control` with visible output values;
- buttons `#rotate-left`, `#rotate-right`, `#reset-layer`, and `#export-button`;
- `<canvas id="card-canvas" width="1536" height="969">` inside a rounded preview shell;
- a polite live region `#status` and an assertive live region `#error`.

Use native `button`, `label`, `input`, and `output`; do not use clickable `div` elements.

- [ ] **Step 3: Bind files, layers, controls and keyboard input**

In `main.ts`, create one `CardEditor` and one current `AssetHandle` per layer. Only revoke an old handle after `setPhoto()` or `setLogo()` resolves successfully. Catch `AssetError` and decode errors separately and write Chinese messages without clearing the valid old layer.

Map the controls as follows:

- slider input calls `setActiveScale()` or `setActiveAngle()`;
- rotate buttons call `rotateActiveBy(-90|90)`;
- reset calls `resetActive()`;
- layer tabs call `selectLayer()`;
- document keydown nudges by 1 or 10 only when the event target is not an input, button, select, textarea or contenteditable element;
- export creates an `<a download>` from the returned data URL and `makeExportFilename()`, clicks it, then removes it;
- `beforeunload` revokes handles and disposes the editor.

Use `data-state="success"` on the status live region for 600ms after photo upload, Logo change and export, then remove the attribute. Never log file contents or data URLs.

- [ ] **Step 4: Implement the Apple-inspired design tokens and motion**

In `styles.css`, define light tokens on `:root` and override under `@media (prefers-color-scheme: dark)`. Use the approved system font stack, a low-contrast radial background, `backdrop-filter: saturate(180%) blur(28px)` panels, 1px translucent borders, 24–32px radii, blue primary actions, and restrained shadows.

Desktop uses a control column no wider than 390px beside a flexible preview. At `max-width: 900px`, stack the preview above controls and keep every hit target at least 44px high. Use `aspect-ratio: 1536 / 969` for the preview shell and keep the Fabric canvas responsive through CSS, not by changing logical dimensions.

Define staggered entrance animations ending within 520ms with `cubic-bezier(0.22, 1, 0.36, 1)`. Limit state transitions to 160–240ms. Under `@media (prefers-reduced-motion: reduce)`, set animation duration and iteration to effectively none, remove transforms, and set transition duration to `0.01ms`.

- [ ] **Step 5: Run the initial browser test and build**

Run: `npm run test:e2e -- --grep "initial editor"`

Expected: PASS.

Run: `npm run build`

Expected: PASS and `dist/index.html` references assets beneath `/sh-card-skin/`.

- [ ] **Step 6: Commit the complete interface**

```bash
git add index.html src/main.ts src/styles.css playwright.config.ts tests/editor.spec.ts
git diff --cached --check
git commit -m "feat: add Apple-inspired editor interface"
```

### Task 6: Browser workflows, documentation and GitHub Pages

**Files:**
- Modify: `tests/editor.spec.ts`
- Create: `README.md`
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: the complete application from Tasks 1–5.
- Produces: repeatable end-to-end evidence, user documentation and automatic public deployment.

- [ ] **Step 1: Add failing end-to-end workflow tests**

Extend `tests/editor.spec.ts` with four flows:

1. Create a portrait PNG buffer in the test, upload it, set angle 45°, select the full Logo, rotate/scale it, export, parse the download with `PNG.sync.read()`, and assert `width === 1536`, `height === 969`.
2. Upload a valid photo, then an invalid text file; assert the error is visible and export remains enabled.
3. Upload a safe inline SVG Logo, then attempt an SVG with `href="https://example.com/a.png"`; assert the external-reference error and that the prior Logo remains selected.
4. Emulate dark color scheme and reduced motion; assert dark CSS variables differ from light mode and entrance animation duration is at most `0.01ms`.

Run: `npm run test:e2e`

Expected: new tests FAIL until any missing hooks or behaviors are completed.

- [ ] **Step 2: Make the smallest UI fixes required by the browser tests**

Add only missing stable hooks, status text, state restoration or styling required by the four flows. Do not add undo, extra filters, multi-Logo support or project persistence.

Run: `npm run test:e2e`

Expected: all browser tests PASS.

- [ ] **Step 3: Write user and contributor documentation**

Create `README.md` with:

- one-sentence purpose and screenshot-free feature list;
- live URL;
- `npm install`, `npm run dev`, `npm run check`, and `npm run test:e2e` commands;
- the six-step usage flow;
- explicit local-only privacy statement;
- exact 1536 × 969 output statement;
- AirCard link and clarification that this project is independent;
- Shanghai Public Transportation Card Logo ownership and `public/logos/SOURCES.md` link;
- deployment note that Pages uses GitHub Actions.

- [ ] **Step 4: Add the Pages workflow**

Create `.github/workflows/pages.yml` triggered by pushes to `main` and manual dispatch. Set:

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
```

The build job must use `actions/checkout@v4`, `actions/setup-node@v4` with Node 24 and npm cache, `npm ci`, `npm run check`, `actions/configure-pages@v5` with `enablement: true`, and `actions/upload-pages-artifact@v4` with `dist`. The deploy job uses environment `github-pages`, needs build, and calls `actions/deploy-pages@v4`.

- [ ] **Step 5: Run full fresh verification**

Run in order:

```bash
npm ci
npm run test:run
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all commands exit 0; unit and browser tests report zero failures; `dist/index.html` exists; only intended Task 6 files remain uncommitted.

- [ ] **Step 6: Perform real-browser visual QA**

Open the local preview at desktop width 1440px and mobile width 390px. Verify light mode, dark mode, reduced motion, mouse drag, Logo rotation handle, photo scale/rotation, keyboard nudge, drop targets, and successful PNG download. Inspect the downloaded PNG dimensions and confirm no rounded transparent corners or control outlines.

Record any browser-specific defect as a failing Playwright test before fixing it.

- [ ] **Step 7: Commit release and deployment files**

```bash
git add tests/editor.spec.ts README.md .github/workflows/pages.yml
git diff --cached --check
git commit -m "ci: publish card editor to Pages"
```

- [ ] **Step 8: Final branch verification before push**

Run:

```bash
npm run check
npm run test:e2e
git status --short --branch
git log --oneline --decorate -8
```

Expected: all checks PASS and the working tree is clean. Push `main` only after reviewing the exact commit list, then verify the remote `main` SHA matches local HEAD and the Pages workflow/URL succeeds.
