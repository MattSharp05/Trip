import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/theme';

import { Text } from './Text';

const RETRY_MS = 400;
const RETRIES = 5;

/**
 * On iOS the sheet draws in a full-window overlay: from the provider at the root it would sit under
 * the native tab and stack views and never show (TR-43). The overlay needs its own gesture root.
 */
function OverlayContainer({ children }: { children?: ReactNode }) {
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>{children}</GestureHandlerRootView>
    </FullWindowOverlay>
  );
}
const containerComponent = Platform.OS === 'ios' ? OverlayContainer : undefined;

export interface SheetProps {
  open: boolean;
  /** Called when the user drags the sheet down or taps the backdrop; set `open` to false. */
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

  const openRef = useRef(open);
  const shown = useRef(false);

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      ref.current?.dismiss();
      return;
    }
    ref.current?.present();
    // A present() during a screen transition can be dropped (TR-43): try again while the sheet
    // hasn't appeared.
    let tries = 0;
    const timer = setInterval(() => {
      if (shown.current || !openRef.current || ++tries > RETRIES) clearInterval(timer);
      else ref.current?.present();
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [open]);

  const handleChange = useCallback((index: number) => {
    shown.current = index >= 0;
  }, []);

  // Only report dismissals the parent didn't ask for (drag down, backdrop tap).
  const handleDismiss = useCallback(() => {
    shown.current = false;
    if (openRef.current) onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={handleDismiss}
      onChange={handleChange}
      containerComponent={containerComponent}
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
