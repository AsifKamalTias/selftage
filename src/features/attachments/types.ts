/** A file chosen by the user that has not been saved yet. */
export interface PickedFile {
  /** Temporary location (cache file on native, blob/data URL on web). */
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

export const MAX_ATTACHMENTS_PER_TRANSACTION = 10;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

export function extensionFor(name: string, mimeType: string | null): string {
  const match = /\.[a-z0-9]{1,8}$/i.exec(name);
  if (match) return match[0].toLowerCase();
  return (mimeType && EXTENSION_BY_MIME[mimeType]) || '';
}

export function isImage(mimeType: string | null, name: string): boolean {
  if (mimeType) return mimeType.startsWith('image/');
  return /\.(jpe?g|png|webp|heic|gif)$/i.test(name);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
