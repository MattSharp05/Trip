import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, continuous, radii, spacing } from '@/theme';

export interface SurfaceProps extends ViewProps {
  /** `raised` sits on a `surface` (e.g. a field inside a card). */
  level?: 'surface' | 'raised';
  /** Inner padding; `none` for rows that pad themselves. */
  padding?: 'none' | 'md' | 'lg';
}

/** A card: a lighter fill and a hairline border on black. No shadows. */
export function Surface({ level = 'surface', padding = 'lg', style, ...rest }: SurfaceProps) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { backgroundColor: level === 'raised' ? colors.raised : colors.surface },
        padding !== 'none' && { padding: spacing[padding] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    ...continuous,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
});
