import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { PassCrop, PassImage } from '@/services/data/types';
import { colors, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { clampCrop, moveCrop, resizeCrop } from './flightInfo';
import { passImageSource } from './passImages';

const MAX_HEIGHT = 520;
const HANDLE = 28;

interface CropEditorProps {
  image: PassImage;
  crop: PassCrop;
  onSave: (crop: PassCrop) => void;
  onCancel: () => void;
  saving?: boolean;
}

/**
 * "Adjust code area": the whole pass image with a rectangle over the code. Drag the rectangle to
 * move it and its corner to resize it.
 */
export function CropEditor({ image, crop: initial, onSave, onCancel, saving }: CropEditorProps) {
  const [available, setAvailable] = useState(0);
  const [crop, setCrop] = useState(() => clampCrop(initial));
  const ratio = image.height / image.width;
  const width = Math.min(available, MAX_HEIGHT / ratio);
  const height = width * ratio;

  // Each update moves the box by the finger's movement since the last one.
  const drag = (apply: (from: PassCrop, dx: number, dy: number) => PassCrop) =>
    Gesture.Pan()
      .runOnJS(true)
      .onChange((e) => {
        if (width > 0) setCrop((c) => apply(c, e.changeX / width, e.changeY / height));
      });
  const move = drag(moveCrop);
  const resize = drag(resizeCrop);

  const rect = {
    left: crop.x * width,
    top: crop.y * height,
    width: crop.width * width,
    height: crop.height * height,
  };

  return (
    <View style={styles.editor} testID="crop-editor">
      <Text variant="subhead" tone="secondary">
        Drag the box over your barcode. Drag its corner to resize it.
      </Text>
      <View style={styles.measure} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <View style={{ width, height }}>
            <Image
              source={passImageSource(image.uri)}
              style={{ width, height }}
              resizeMode="stretch"
            />
            {/* Dim everything outside the box. */}
            <View style={[styles.shade, { left: 0, top: 0, right: 0, height: rect.top }]} />
            <View
              style={[styles.shade, { left: 0, right: 0, top: rect.top + rect.height, bottom: 0 }]}
            />
            <View
              style={[
                styles.shade,
                { left: 0, top: rect.top, width: rect.left, height: rect.height },
              ]}
            />
            <View
              style={[
                styles.shade,
                { left: rect.left + rect.width, right: 0, top: rect.top, height: rect.height },
              ]}
            />
            <GestureDetector gesture={move}>
              <View style={[styles.box, rect]} testID="crop-box">
                <GestureDetector gesture={resize}>
                  <View style={styles.handle} hitSlop={spacing.md} testID="crop-handle" />
                </GestureDetector>
              </View>
            </GestureDetector>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} testID="crop-cancel" />
        </View>
        <View style={styles.action}>
          <Button label="Save" onPress={() => onSave(crop)} disabled={saving} testID="crop-save" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.lg },
  measure: { alignSelf: 'stretch', alignItems: 'center' },
  shade: { position: 'absolute', backgroundColor: colors.backdrop },
  box: { position: 'absolute', borderWidth: 2, borderColor: colors.accent },
  handle: {
    position: 'absolute',
    right: -HANDLE / 2,
    bottom: -HANDLE / 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: colors.accent,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
