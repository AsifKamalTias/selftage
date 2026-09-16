import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from './types';

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

function fromImageAsset(asset: ImagePicker.ImagePickerAsset, index: number): PickedFile {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const fallbackName = `photo-${Date.now()}-${index + 1}.${mimeType.split('/')[1] ?? 'jpg'}`;
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    mimeType,
    size: asset.fileSize ?? null,
  };
}

export async function pickImages(limit: number): Promise<PickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map(fromImageAsset);
}

export async function takePhoto(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PermissionDeniedError('Camera access is needed to photograph receipts.');
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return [];
  return result.assets.map(fromImageAsset);
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  }));
}
