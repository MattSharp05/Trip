import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { PassCrop, PassImage } from '@/services/data/types';

import { cropLayout } from './flightInfo';
import { passImageSource } from './passImages';

/** The code is drawn at most this big, in points. */
const MAX_WIDTH = 240;
const MAX_HEIGHT = 240;

/** The barcode cut out of the user's own boarding pass image (nothing is generated). */
export function PassCode({ image, crop }: { image: PassImage; crop: PassCrop }) {
  const [available, setAvailable] = useState(0);
  const aspect = (crop.width * image.width) / (crop.height * image.height);
  const width = Math.min(available, MAX_WIDTH, MAX_HEIGHT * aspect);
  const layout = cropLayout(crop, image, width);

  return (
    <View
      style={styles.measure}
      onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}
      testID="pass-code"
    >
      {width > 0 ? (
        <View style={[styles.frame, layout.frame]}>
          <Image
            source={passImageSource(image.uri)}
            style={[styles.image, layout.image]}
            resizeMode="stretch"
            accessibilityLabel="Boarding pass code"
            testID="pass-code-image"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { alignSelf: 'stretch', alignItems: 'center' },
  frame: { overflow: 'hidden' },
  image: { position: 'absolute' },
});
