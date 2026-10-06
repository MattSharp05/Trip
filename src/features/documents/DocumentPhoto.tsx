import { Image, type ImageContentFit } from 'expo-image';
import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors, continuous, radii } from '@/theme';
import { Skeleton } from '@/ui';

import { usePhotoUri } from './photos';

interface DocumentPhotoProps {
  path: string;
  label: string;
  width?: DimensionValue;
  height: number;
  fit?: ImageContentFit;
  /** Rounded card corners; off for the full-screen viewer. */
  rounded?: boolean;
  testID?: string;
}

/** One document photo, from the phone or from private Storage; a skeleton while it loads. */
export function DocumentPhoto({
  path,
  label,
  width = '100%',
  height,
  fit = 'cover',
  rounded = true,
  testID,
}: DocumentPhotoProps) {
  const uri = usePhotoUri(path);
  return (
    <View style={[styles.frame, rounded && styles.rounded, { width, height }]} testID={testID}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit={fit}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={label}
          transition={150}
        />
      ) : (
        <Skeleton height={height} radius={rounded ? 'card' : undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  rounded: {
    borderRadius: radii.card,
    ...continuous,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.raised,
  },
});
