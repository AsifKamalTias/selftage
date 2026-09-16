import type { NewAttachment } from '@/features/transactions/repository';

import type { PickedFile } from './types';

/**
 * Web has no persistent file system, so attachments are stored inline as data
 * URLs in SQLite (which lives in OPFS). Keep them small.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

async function toDataUrl(uri: string): Promise<{ dataUrl: string; size: number }> {
  if (uri.startsWith('data:')) {
    return { dataUrl: uri, size: Math.round((uri.length - uri.indexOf(',') - 1) * 0.75) };
  }
  const blob = await (await fetch(uri)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, size: blob.size };
}

export async function persistAttachment(
  file: PickedFile,
  _transactionId: string
): Promise<NewAttachment> {
  const { dataUrl, size } = await toDataUrl(file.uri);
  return { uri: dataUrl, name: file.name, mimeType: file.mimeType, size: file.size ?? size };
}

export function deleteAttachmentFiles(_uris: string[]): void {
  // Data lives in the database row, which is already gone.
}

export function deleteAllAttachmentFiles(): void {
  // Nothing stored outside the database on web.
}
