import { Directory, File, Paths } from 'expo-file-system';

import type { NewAttachment } from '@/features/transactions/repository';
import { newId } from '@/lib/id';

import { extensionFor, type PickedFile } from './types';

/** Native: attachments are copied into the app's persistent document directory. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function rootDirectory() {
  return new Directory(Paths.document, 'attachments');
}

export async function persistAttachment(
  file: PickedFile,
  transactionId: string
): Promise<NewAttachment> {
  const dir = new Directory(rootDirectory(), transactionId);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const destination = new File(dir, `${newId()}${extensionFor(file.name, file.mimeType)}`);
  await new File(file.uri).copy(destination);
  return {
    uri: destination.uri,
    name: file.name,
    mimeType: file.mimeType,
    size: destination.size || file.size,
  };
}

export function deleteAttachmentFiles(uris: string[]): void {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('Failed to delete attachment file', uri, error);
    }
  }
}

export function deleteAllAttachmentFiles(): void {
  try {
    const dir = rootDirectory();
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn('Failed to delete attachments directory', error);
  }
}
