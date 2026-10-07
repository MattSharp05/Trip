import { StyleSheet, View } from 'react-native';

import { screenPadding, spacing } from '@/theme';
import { Button } from '@/ui';

/** The header's height: the 50 pt button and its padding (the list's row offsets add it). */
export const PLAN_ALL_HEIGHT = 50 + spacing.md * 2;

export interface PlanAllButtonProps {
  onPress: () => void;
}

/** "Plan my bucket list" at the top of the Bucket List: places everything that fits (TR-32). */
export function PlanAllButton({ onPress }: PlanAllButtonProps) {
  return (
    <View style={styles.wrap}>
      <Button
        label="Plan my bucket list"
        icon="wand.and.stars"
        onPress={onPress}
        testID="bucket-plan-all"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: PLAN_ALL_HEIGHT,
    paddingHorizontal: screenPadding,
    justifyContent: 'center',
  },
});
