import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

import { openAttachment } from '../open';
import { formatFileSize, isImage } from '../types';

export interface GalleryItem {
  key: string;
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

const TILE = 92;

/** Thumbnails for images, file cards for documents. Tap to view, optional remove button. */
export function AttachmentGallery({
  items,
  onRemove,
}: {
  items: GalleryItem[];
  onRemove?: (key: string) => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [preview, setPreview] = useState<GalleryItem | null>(null);

  const open = async (item: GalleryItem) => {
    if (isImage(item.mimeType, item.name)) {
      setPreview(item);
      return;
    }
    try {
      await openAttachment(item.uri, item.mimeType, item.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the file');
    }
  };

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const image = isImage(item.mimeType, item.name);
        return (
          <View key={item.key} style={styles.tileWrap}>
            <PressableScale
              scaleTo={0.95}
              onPress={() => open(item)}
              accessibilityLabel={`Open ${item.name}`}
              style={[
                styles.tile,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}>
              {image ? (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={styles.file}>
                  <Icon name="document-text" size={28} color="primary" />
                  <Text variant="micro" numberOfLines={2} align="center">
                    {item.name}
                  </Text>
                  <Text variant="micro" color="textMuted">
                    {formatFileSize(item.size)}
                  </Text>
                </View>
              )}
            </PressableScale>
            {onRemove ? (
              <Pressable
                onPress={() => onRemove(item.key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                style={[
                  styles.remove,
                  { backgroundColor: colors.danger, borderColor: colors.surface },
                ]}>
                <Icon name="close" size={14} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <ImagePreview item={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

function ImagePreview({ item, onClose }: { item: GalleryItem | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  return (
    <Modal
      visible={!!item}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.previewBackdrop}>
        {item ? (
          <Animated.View entering={FadeIn} style={styles.previewBody}>
            <Image source={{ uri: item.uri }} style={styles.previewImage} contentFit="contain" />
          </Animated.View>
        ) : null}
        <View style={[styles.previewBar, { top: insets.top + spacing.sm }]}>
          <Text weight="semibold" color="#FFFFFF" numberOfLines={1} style={styles.previewTitle}>
            {item?.name}
          </Text>
          <IconButton
            icon="close"
            onPress={onClose}
            accessibilityLabel="Close preview"
            color="#FFFFFF"
            variant="plain"
          />
        </View>
        {item && Platform.OS !== 'web' ? (
          <View style={[styles.previewFooter, { bottom: insets.bottom + spacing.lg }]}>
            <Button
              title="Share"
              icon="share-outline"
              variant="secondary"
              onPress={() =>
                openAttachment(item.uri, item.mimeType, item.name).catch((e: Error) =>
                  toast.error(e.message)
                )
              }
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tileWrap: {
    width: TILE,
    height: TILE,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
  },
  file: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    gap: 2,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  previewBody: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
  },
  previewBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewTitle: {
    flex: 1,
  },
  previewFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
