import './styles.css';
import { AssetError, createAssetHandle, type AssetHandle, type AssetRole } from './assets';
import {
  CardEditor,
  StaleAssetLoadError,
  type EditorSnapshot,
  type LayerName,
} from './card-editor';
import { makeExportFilename } from './export';

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`页面缺少元素：${selector}`);
  return found;
}

const canvasElement = element<HTMLCanvasElement>('#card-canvas');
const photoInput = element<HTMLInputElement>('#photo-input');
const logoInput = element<HTMLInputElement>('#logo-input');
const scaleControl = element<HTMLInputElement>('#scale-control');
const angleControl = element<HTMLInputElement>('#angle-control');
const scaleOutput = element<HTMLOutputElement>('#scale-output');
const angleOutput = element<HTMLOutputElement>('#angle-output');
const exportButton = element<HTMLButtonElement>('#export-button');
const status = element<HTMLParagraphElement>('#status');
const error = element<HTMLParagraphElement>('#error');
const emptyCopy = element<HTMLDivElement>('.empty-canvas-copy');
const previewShell = element<HTMLDivElement>('[data-testid="preview-shell"]');
const layerButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-layer]')];
const transformButtons = [
  element<HTMLButtonElement>('#rotate-left'),
  element<HTMLButtonElement>('#rotate-right'),
  element<HTMLButtonElement>('#reset-layer'),
];

const handles: Record<AssetRole, AssetHandle | null> = { photo: null, logo: null };
let successTimer = 0;
let activePreset: string | null = null;

function showSuccess(message: string): void {
  window.clearTimeout(successTimer);
  status.textContent = message;
  status.dataset.state = 'success';
  successTimer = window.setTimeout(() => delete status.dataset.state, 600);
}

function showError(message: string): void {
  error.textContent = message;
}

function clearError(): void {
  error.textContent = '';
}

function renderSnapshot(snapshot: EditorSnapshot): void {
  for (const button of layerButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.layer === snapshot.activeLayer));
  }
  const hasActiveLayer = snapshot.activeLayer !== null;
  scaleControl.disabled = !hasActiveLayer;
  angleControl.disabled = !hasActiveLayer;
  for (const button of transformButtons) button.disabled = !hasActiveLayer;

  scaleControl.value = String(Math.min(Number(scaleControl.max), Math.max(Number(scaleControl.min), snapshot.scale)));
  angleControl.value = String(Math.round(snapshot.angle));
  scaleOutput.value = `${Math.round(snapshot.scale * 100)}%`;
  angleOutput.value = `${Math.round(snapshot.angle)}°`;
  exportButton.disabled = !snapshot.hasPhoto;
  emptyCopy.hidden = snapshot.hasPhoto;
}

const editor = new CardEditor(canvasElement, renderSnapshot);
renderSnapshot({ activeLayer: null, hasPhoto: false, hasLogo: false, angle: 0, scale: 1 });

async function loadFile(file: File, role: AssetRole): Promise<void> {
  let nextHandle: AssetHandle | null = null;
  try {
    nextHandle = await createAssetHandle(file, role);
    if (role === 'photo') await editor.setPhoto(nextHandle.url);
    else await editor.setLogo(nextHandle.url);

    handles[role]?.revoke();
    handles[role] = nextHandle;
    if (role === 'logo') {
      activePreset = null;
      updatePresetButtons();
    }
    clearError();
    showSuccess(role === 'photo' ? '照片已就位，可以调整取景了。' : '自定义 Logo 已添加。');
  } catch (caught) {
    nextHandle?.revoke();
    if (caught instanceof StaleAssetLoadError) return;
    if (caught instanceof AssetError) showError(caught.message);
    else showError(role === 'photo' ? '照片无法读取，请换一张图片。' : 'Logo 无法读取，请换一个文件。');
  }
}

function updatePresetButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-logo]')) {
    button.setAttribute('aria-pressed', String(button.dataset.logo === activePreset));
  }
}

async function loadPreset(name: string): Promise<void> {
  const path = `${import.meta.env.BASE_URL}logos/sptcc-${name}.png`;
  try {
    await editor.setLogo(path);
    handles.logo?.revoke();
    handles.logo = null;
    activePreset = name;
    updatePresetButtons();
    clearError();
    showSuccess(name === 'full' ? '已添加上海公共交通卡完整标识。' : '已添加上海公共交通卡图形标识。');
  } catch (caught) {
    if (caught instanceof StaleAssetLoadError) return;
    showError('内置 Logo 加载失败，请刷新页面后重试。');
  }
}

element<HTMLButtonElement>('#choose-photo').addEventListener('click', () => photoInput.click());
element<HTMLButtonElement>('#choose-logo').addEventListener('click', () => logoInput.click());

for (const [input, role] of [[photoInput, 'photo'], [logoInput, 'logo']] as const) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void loadFile(file, role);
    input.value = '';
  });
}

const photoDropZone = element<HTMLElement>('[data-drop-role="photo"]');
for (const eventName of ['dragenter', 'dragover']) {
  photoDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    photoDropZone.dataset.dragging = 'true';
  });
}
for (const eventName of ['dragleave', 'drop']) {
  photoDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    delete photoDropZone.dataset.dragging;
  });
}
photoDropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) void loadFile(file, 'photo');
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-logo]')) {
  button.addEventListener('click', () => void loadPreset(button.dataset.logo ?? 'full'));
}

for (const button of layerButtons) {
  button.addEventListener('click', () => {
    editor.selectLayer(button.dataset.layer as LayerName);
    previewShell.focus();
  });
}

scaleControl.addEventListener('input', () => editor.setActiveScale(Number(scaleControl.value)));
angleControl.addEventListener('input', () => editor.setActiveAngle(Number(angleControl.value)));
element<HTMLButtonElement>('#rotate-left').addEventListener('click', () => editor.rotateActiveBy(-90));
element<HTMLButtonElement>('#rotate-right').addEventListener('click', () => editor.rotateActiveBy(90));
element<HTMLButtonElement>('#reset-layer').addEventListener('click', () => editor.resetActive());

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.matches('input, button, select, textarea, [contenteditable="true"]')) return;
  const delta = event.shiftKey ? 10 : 1;
  const movement: Record<string, [number, number]> = {
    ArrowLeft: [-delta, 0],
    ArrowRight: [delta, 0],
    ArrowUp: [0, -delta],
    ArrowDown: [0, delta],
  };
  const [dx, dy] = movement[event.key] ?? [];
  if (dx === undefined || dy === undefined) return;
  event.preventDefault();
  editor.nudgeActive(dx, dy);
});

exportButton.addEventListener('click', () => {
  try {
    const link = document.createElement('a');
    link.download = makeExportFilename();
    link.href = editor.exportPngDataUrl();
    document.body.append(link);
    link.click();
    link.remove();
    clearError();
    showSuccess('PNG 已导出，可以交给 AirCard 使用。');
  } catch (caught) {
    showError(caught instanceof Error ? caught.message : '导出失败，请重试。');
  }
});

window.addEventListener('beforeunload', () => {
  window.clearTimeout(successTimer);
  handles.photo?.revoke();
  handles.logo?.revoke();
  editor.dispose();
});
