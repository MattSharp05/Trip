import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Text } from '@/ui';

import { LEGAL_UPDATED, type LegalDocument } from './legal';
import { SettingsScroll } from './SettingsList';

/** Terms or Privacy as plain, readable text. The title is in the native header. */
export function LegalScreen({ document }: { document: LegalDocument }) {
  return (
    <SettingsScroll testID="legal">
      <View style={styles.block}>
        <Text variant="caption" tone="secondary">
          {`Updated ${LEGAL_UPDATED}`}
        </Text>
        <Text variant="body">{document.intro}</Text>
      </View>
      {document.sections.map((s) => (
        <View key={s.heading} style={styles.block}>
          <Text variant="headline" accessibilityRole="header">
            {s.heading}
          </Text>
          <Text variant="body" tone="secondary">
            {s.body}
          </Text>
        </View>
      ))}
    </SettingsScroll>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
});
