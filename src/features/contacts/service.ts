import type { SQLiteDatabase } from 'expo-sqlite';

import { toFriendlyError } from '@/db/client';
import { deleteAttachmentFiles, persistAttachment } from '@/features/attachments/storage';
import type { PickedFile } from '@/features/attachments/types';
import { newId } from '@/lib/id';

import { createContact, deleteContact, updateContact, type ContactInput } from './repository';

export interface ContactSaveInput extends Omit<ContactInput, 'photoUri'> {
  /** Keeps the stored photo when no new one was picked. */
  photoUri: string | null;
  /** A freshly picked photo, copied into app storage before saving. */
  photo?: PickedFile | null;
}

/** Saves the contact, persisting a picked photo first and cleaning up the old one. */
export async function saveContact(
  db: SQLiteDatabase,
  { id, input }: { id?: string; input: ContactSaveInput }
): Promise<string> {
  const contactId = id ?? newId();
  const { photo, ...rest } = input;
  let stored: string | null = null;
  try {
    if (photo) {
      const saved = await persistAttachment(photo, `contacts/${contactId}`);
      stored = saved.uri;
    }
    const data: ContactInput = { ...rest, photoUri: stored ?? rest.photoUri };
    if (id) {
      const previous = rest.photoUri;
      await updateContact(db, id, data);
      // Only drop the old file once the row points at the new one.
      if (stored && previous && previous !== stored) deleteAttachmentFiles([previous]);
      return id;
    }
    return await createContact(db, data);
  } catch (error) {
    if (stored) deleteAttachmentFiles([stored]);
    throw toFriendlyError(error);
  }
}

export async function removeContact(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    const photoUri = await deleteContact(db, id);
    if (photoUri) deleteAttachmentFiles([photoUri]);
  } catch (error) {
    throw toFriendlyError(error);
  }
}
