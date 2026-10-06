import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

export interface SheetProps {
  open: boolean;
  /** Called when the user drags the sheet down or taps the backdrop. */
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * A bottom sheet over the current screen (wraps `@gorhom/bottom-sheet`). Sized to its content;
 * needs `BottomSheetModalProvider` at the root (app/_layout.tsx).
 */
export function Sheet({ open, onClose, title, children, testID }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        testID={testID}
      >
        {title ? (
          <Text variant="headline" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.raised,
    borderRadius: radii.photo + spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  handle: { backgroundColor: colors.textSecondary, width: 36 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md },
});
