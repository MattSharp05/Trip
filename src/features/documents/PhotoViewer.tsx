import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenPadding, spacing } from '@/theme';
import { IconButton, Text } from '@/ui';

import { DocumentPhoto } from './DocumentPhoto';

interface PhotoViewerProps {
  paths: readonly string[];
  /** The photo to open on; null keeps the viewer closed. */
  index: number | null;
  title: string;
  onClose: () => void;
}

/**
 * Full-screen document photos: swipe between them, pinch to zoom. Zoom is the
 * native UIScrollView zoom that ScrollView exposes on iOS, so it needs nothing outside Expo Go.
 */
export function PhotoViewer({ paths, index, title, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const open = index !== null && paths.length > 0;

  return (
    <Modal
      visible={open}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.screen} testID="document-photo-viewer">
        {open ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (index ?? 0) * width, y: 0 }}
          >
            {paths.map((path, i) => (
              <ScrollView
                key={path}
                style={{ width, height }}
                contentContainerStyle={styles.page}
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                testID={`document-photo-zoom-${i}`}
              >
                <DocumentPhoto
                  path={path}
                  label={`${title}, photo ${i + 1} of ${paths.length}`}
                  width={width}
                  height={height}
                  fit="contain"
                  rounded={false}
                />
              </ScrollView>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.bar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <Text variant="headline">{title}</Text>
          <IconButton icon="xmark" label="Close" onPress={onClose} testID="document-photo-close" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute',
    left: screenPadding,
    right: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
