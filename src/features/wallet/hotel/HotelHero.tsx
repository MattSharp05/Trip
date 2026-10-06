import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PhotoCreditLine } from '@/features/trips/PhotoCreditLine';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon } from '@/ui';

import type { HotelPhoto } from './useHotelPhoto';

/** The big photo at the top of the hotel screen; a plain raised panel until there's a photo. */
export function HotelHero({ photo }: { photo: HotelPhoto | null }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        {photo ? (
          <Image
            source={{ uri: photo.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
            testID="hotel-photo"
          />
        ) : (
          <View style={styles.placeholder} testID="hotel-photo-placeholder">
            <Icon name="bed.double" size="xl" tone="secondary" />
          </View>
        )}
      </View>
      {photo?.credit ? <PhotoCreditLine credit={photo.credit} testID="hotel-photo-credit" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  hero: {
    height: 200,
    borderRadius: radii.photo,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
