import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSaveBooking } from '@/services/data';
import type { PassCrop } from '@/services/data/types';
import { colors, continuous, passColors, radii, screenPadding, spacing } from '@/theme';
import {
  Button,
  Icon,
  ListRow,
  LoadError,
  Skeleton,
  Surface,
  Text,
  Toast,
  useTabBarInset,
} from '@/ui';

import { pickPassImage } from './actions';
import { CropEditor } from './CropEditor';
import { DEFAULT_CROP, localLabels } from './flightInfo';
import { FlightRoute } from './FlightRoute';
import { PassCode } from './PassCode';
import { useBrightnessBoost } from './useBrightnessBoost';
import { useFlightBooking } from './useFlightBooking';
import { useWallet } from '../useWallet';

function Field({ label, value, end }: { label: string; value: string | null; end?: boolean }) {
  return (
    <View style={[styles.field, end && styles.fieldEnd]}>
      <Text variant="caption" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <Text variant="title" numberOfLines={1}>
        {value ?? '–'}
      </Text>
    </View>
  );
}

/**
 * The boarding pass: the flight's key facts in a pass layout, and the barcode cropped from the pass
 * the user added. The screen goes to full brightness while it's open.
 */
export function BoardingPass({ id }: { id: string }) {
  const { loadError, retry } = useWallet();
  const tabBarInset = useTabBarInset();
  useBrightnessBoost();
  const { flight: booking, isLoading } = useFlightBooking(id);
  const save = useSaveBooking();
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flight = booking?.data;

  const addPass = async () => {
    if (!booking) return;
    try {
      const passImage = await pickPassImage();
      if (!passImage) return;
      await save.mutateAsync({
        ...booking,
        data: { ...booking.data, passImage, passCrop: DEFAULT_CROP },
      });
      setEditing(true);
    } catch {
      setToast("Couldn't add your boarding pass");
    }
  };

  const saveCrop = async (passCrop: PassCrop) => {
    if (!booking) return;
    try {
      await save.mutateAsync({ ...booking, data: { ...booking.data, passCrop } });
      setEditing(false);
    } catch {
      setToast("Couldn't save the code area");
    }
  };

  const image = flight?.passImage ?? null;
  const crop = flight?.passCrop ?? DEFAULT_CROP;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
      >
        <Stack.Screen
          options={{ headerShown: true, title: 'Boarding pass', headerBackTitle: 'Flight' }}
        />
        {isLoading ? (
          <Skeleton height={520} radius="card" />
        ) : !flight ? (
          loadError ? (
            <LoadError
              message="Couldn't load this flight. Check your connection."
              onRetry={retry}
            />
          ) : (
            <View style={styles.missing}>
              <Text variant="headline">This flight is no longer in your wallet</Text>
            </View>
          )
        ) : editing && image ? (
          <CropEditor
            image={image}
            crop={crop}
            onSave={saveCrop}
            onCancel={() => setEditing(false)}
            saving={save.isPending}
          />
        ) : (
          <>
            <View style={styles.pass} testID="boarding-pass">
              <View style={styles.band}>
                <Text variant="headline">{flight.airline}</Text>
                <Text variant="headline" tone="secondary">
                  {flight.flightNumber}
                </Text>
              </View>
              <View style={styles.body}>
                <FlightRoute flight={flight} times={false} />
                <View style={styles.grid}>
                  <Field label="Date" value={localLabels(flight.departs).day} />
                  <Field
                    label="Boarding"
                    value={
                      flight.boardingTime
                        ? localLabels({ ...flight.departs, time: flight.boardingTime }).time
                        : null
                    }
                  />
                  <Field label="Departs" value={localLabels(flight.departs).time} end />
                </View>
                <View style={styles.grid}>
                  <Field label="Gate" value={flight.gate} />
                  <Field label="Group" value={flight.boardingGroup} />
                  <Field label="Seat" value={flight.seat} end />
                </View>
                <View style={styles.grid}>
                  <Field label="Passenger" value={flight.passenger} />
                  <Field label="Confirmation" value={flight.confirmation} end />
                </View>
              </View>
              <View style={styles.perforation} />
              <View style={styles.codeArea}>
                {image ? (
                  <>
                    <View style={styles.codePanel}>
                      <PassCode image={image} crop={crop} />
                    </View>
                    <Text variant="subhead" tone="secondary">
                      {[flight.flightNumber, flight.seat].filter(Boolean).join(' · ')}
                    </Text>
                  </>
                ) : (
                  <View style={styles.empty} testID="pass-add-prompt">
                    <Icon name="qrcode.viewfinder" size="xl" tone="secondary" />
                    <Text variant="body" tone="secondary" style={styles.center}>
                      Add your boarding pass to show its code
                    </Text>
                    <Button
                      label="Add boarding pass"
                      icon="photo"
                      onPress={addPass}
                      testID="pass-add"
                    />
                  </View>
                )}
              </View>
            </View>
            {image ? (
              <Surface padding="none">
                <ListRow
                  icon="crop"
                  title="Adjust code area"
                  onPress={() => setEditing(true)}
                  testID="pass-adjust"
                />
              </Surface>
            ) : null}
          </>
        )}
      </ScrollView>
      <Toast visible={toast !== null} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: screenPadding },
  pass: {
    borderRadius: radii.photo,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  band: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.raised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  body: { gap: spacing.xl, padding: spacing.lg },
  grid: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xxs },
  fieldEnd: { alignItems: 'flex-end' },
  label: { textTransform: 'uppercase', letterSpacing: 0.5 },
  perforation: {
    marginHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
  },
  codeArea: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  codePanel: {
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: passColors.codeBackground,
  },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  center: { textAlign: 'center' },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
