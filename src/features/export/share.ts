import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

async function share(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}

/** Writes a text file to the cache directory and opens the share sheet. */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  // A BOM lets spreadsheet apps detect UTF-8 (currency symbols, non-Latin names).
  file.write(`﻿${content}`);
  await share(file.uri, mimeType, fileName);
}

/**
 * Renders HTML to a PDF and opens the share sheet. The printed file is given a
 * readable name when possible, but a failure to rename never costs the export —
 * the original file is shared instead.
 */
export async function sharePdf(fileName: string, html: string) {
  const { uri } = await Print.printToFileAsync({ html });

  let shareUri = uri;
  try {
    const target = new File(Paths.cache, fileName);
    if (target.exists) target.delete();
    new File(uri).copy(target);
    shareUri = target.uri;
  } catch (error) {
    console.warn('Could not rename the printed report', error);
  }

  await share(shareUri, 'application/pdf', fileName);
}
