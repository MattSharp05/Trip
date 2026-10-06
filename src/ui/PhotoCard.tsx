import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, continuous, photoScrim, radii, spacing } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export interface PhotoCardProps {
  source: ImageSource | number;
  title: string;
  subtitle?: string;
  height?: number;
  /** Shows a chevron button in the corner, like the trip cards. */
  onPress?: () => void;
  testID?: string;
}

/** A big photo card: image, a subtle dark scrim, and the title over it. */
export function PhotoCard({
  source,
  title,
  subtitle,
  height = 120,
  onPress,
  testID,
}: PhotoCardProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, { height }, pressed && styles.pressed]}
    >
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <View style={styles.scrim} testID={testID ? `${testID}-scrim` : undefined} />
      <View style={styles.footer}>
        <View style={styles.text}>
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subhead" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onPress ? (
          <View style={styles.chevron}>
            <Icon name="chevron.right" size="sm" weight="semibold" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.photo,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    justifyContent: 'flex-end',
  },
  scrim: { position: 'absolute', inset: 0, experimental_backgroundImage: photoScrim },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xxs },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  pressed: { opacity: 0.85 },
});
