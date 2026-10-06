import { Linking, StyleSheet } from 'react-native';

import type { PhotoCredit } from '@/services/data';
import { Text } from '@/ui';

const UNSPLASH = 'https://unsplash.com/?utm_source=trip_demo&utm_medium=referral';

const open = (url: string) => () => {
  void Linking.openURL(url).catch(() => {});
};

/** "Photo by <name> on Unsplash", both linked, as Unsplash's API guidelines ask. */
export function PhotoCreditLine({ credit, testID }: { credit: PhotoCredit; testID?: string }) {
  return (
    <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.line} testID={testID}>
      Photo by{' '}
      <Text
        variant="caption"
        tone="secondary"
        accessibilityRole="link"
        onPress={open(credit.photographerUrl)}
        style={styles.link}
      >
        {credit.photographer}
      </Text>{' '}
      on{' '}
      <Text
        variant="caption"
        tone="secondary"
        accessibilityRole="link"
        onPress={open(UNSPLASH)}
        style={styles.link}
      >
        Unsplash
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { paddingHorizontal: 4 },
  link: { textDecorationLine: 'underline' },
});
