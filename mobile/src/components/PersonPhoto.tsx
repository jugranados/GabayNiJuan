import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/theme';

type Props = {
  /** Full name, used for the accessibility label and the initials fallback. */
  name: string;
  uri?: string;
  size?: number;
};

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Square-ratio circular portrait. Shows a neutral initials placeholder when
 * there is no photo, while it loads, or if it fails to load, so layout never
 * shifts and a broken image is never shown.
 */
export function PersonPhoto({ name, uri, size = 56 }: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const showImage = Boolean(uri) && status !== 'failed';
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={showImage ? `Photo of ${name}` : `No photo available for ${name}`}
      style={[styles.frame, dimension]}
    >
      {showImage ? (
        <Image
          testID="person-photo-image"
          source={{ uri }}
          style={dimension}
          resizeMode="cover"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {!showImage || status === 'loading' ? (
        <View style={[styles.placeholder, dimension]} pointerEvents="none">
          <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.border, overflow: 'hidden' },
  placeholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  initials: { color: colors.textMuted, fontWeight: '600' },
});
