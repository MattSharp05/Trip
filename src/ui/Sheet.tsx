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
  /** Called once the sheet is off screen, however it closed: then a native dialog can show. */
  onClosed?: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * A bottom sheet over the current screen (wraps `@gorhom/bottom-sheet`). Sized to its content;
 * needs `BottomSheetModalProvider` at the root (app/_layout.tsx).
 *
 * On iOS nothing native can be presented from inside it: `Alert`, `ActionSheetIOS`, `Share` and
 * compact date pickers open behind the overlay, out of reach (TR-56). Ask in the sheet with
 * `SheetConfirm`, or close the sheet and present from `onClosed`.
 */
export function Sheet({ open, onClose, onClosed, title, children, testID }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  const openRef = useRef(open);
  const shown = useRef(false);

  useEffect(() => {
    openRef.current = open;
    if (!open) {
      // Only a sheet on screen is dismissed. A dismiss() before the modal has shown (on mount, or
      // while a present() is pending) leaves gorhom's modal "dismissing" with nothing to close, and
      // a dismissing modal never renders again: every later present() did nothing (TR-27 QA round
      // 2). A sheet closed while it was still appearing is dismissed once it has shown.
      if (shown.current) ref.current?.dismiss();
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
    if (shown.current && !openRef.current) ref.current?.dismiss();
  }, []);

  // Only report dismissals the parent didn't ask for (drag down, backdrop tap).
  const handleDismiss = useCallback(() => {
    shown.current = false;
    if (openRef.current) onClose();
    onClosed?.();
  }, [onClose, onClosed]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      // gorhom makes the whole sheet one accessibility element ("Bottom Sheet") by default, which
      // hides its title, buttons and fields from VoiceOver and from XCTest (TR-40: Maestro saw
      // the sheet's testID but none of its content).
      accessible={false}
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
