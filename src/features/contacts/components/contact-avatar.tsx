import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';

/** Two letters at most, so a long name still fits the circle. */
export function initialsFor(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function ContactAvatar({
  name,
  photoUri,
  size = 44,
}: {
  name: string;
  photoUri?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const radius = size / 2;

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: colors.primaryMuted },
      ]}>
      <Text weight="bold" color="primary" style={{ fontSize: size * 0.36 }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
