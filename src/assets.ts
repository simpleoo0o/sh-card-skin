export type AssetRole = 'photo' | 'logo';

export interface AssetHandle {
  url: string;
  revoke(): void;
}

export class AssetError extends Error {
  override name = 'AssetError';
}

const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
  role: AssetRole,
): void {
  if (file.size === 0) {
    throw new AssetError('图片文件是空的');
  }
  if (rasterTypes.has(file.type)) {
    return;
  }
  if (role === 'logo' && file.type === 'image/svg+xml') {
    return;
  }
  throw new AssetError(
    role === 'photo'
      ? '照片仅支持 JPG、PNG 或 WebP'
      : 'Logo 仅支持 PNG、JPG、WebP 或 SVG',
  );
}

function assertLocalUrls(value: string): void {
  if (/@import\b/i.test(value)) {
    throw new AssetError('SVG 不能引用外部资源');
  }

  const remainder = value.replace(/url\(\s*([^)]*?)\s*\)/gi, (_match, rawValue: string) => {
    let resource = rawValue.trim();
    const quote = resource[0];
    if (quote === '"' || quote === "'") {
      if (!resource.endsWith(quote)) throw new AssetError('SVG 不能引用外部资源');
      resource = resource.slice(1, -1).trim();
    }
    if (!/^#[A-Za-z_][\w:.-]*$/.test(resource)) {
      throw new AssetError('SVG 不能引用外部资源');
    }
    return '';
  });
  if (/url\s*\(/i.test(remainder)) {
    throw new AssetError('SVG 不能引用外部资源');
  }
}

export function sanitizeSvg(source: string): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (document.querySelector('parsererror') || root.localName.toLowerCase() !== 'svg') {
    throw new AssetError('SVG 文件无效');
  }
  if (root.querySelector('script, foreignObject')) {
    throw new AssetError('SVG 包含不安全内容');
  }

  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of element.getAttributeNames()) {
      const value = element.getAttribute(attribute) ?? '';
      const normalizedName = attribute.toLowerCase();
      if (normalizedName.startsWith('on')) {
        throw new AssetError('SVG 包含不安全内容');
      }
      if ((normalizedName === 'href' || normalizedName === 'xlink:href') && !value.trim().startsWith('#')) {
        throw new AssetError('SVG 不能引用外部资源');
      }
      assertLocalUrls(value);
    }
    if (element.localName.toLowerCase() === 'style') {
      assertLocalUrls(element.textContent ?? '');
    }
  }

  return new XMLSerializer().serializeToString(root);
}

export async function createAssetHandle(file: File, role: AssetRole): Promise<AssetHandle> {
  validateImageFile(file, role);
  const source = file.type === 'image/svg+xml'
    ? new Blob([sanitizeSvg(await file.text())], { type: 'image/svg+xml' })
    : file;
  const url = URL.createObjectURL(source);
  let revoked = false;

  return {
    url,
    revoke() {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}
