import * as Sharing from 'expo-sharing';

/** Hands a stored file to the OS so the user can view or share it (e.g. PDFs). */
export async function openAttachment(uri: string, mimeType: string | null, name: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Opening files is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: mimeType ?? undefined,
    dialogTitle: name,
  });
}
