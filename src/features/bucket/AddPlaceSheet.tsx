import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { kindLabel } from '@/core/bucket';
import { pinSymbol, type LngLat } from '@/features/map';
import { queryClient } from '@/services/data';
import { searchSpots, type SpotResult } from '@/services/places';
import { colors, continuous, radii, spacing, typography } from '@/theme';
import { Button, Icon, ListRow, Sheet, Skeleton, Text } from '@/ui';

/** What the Add sheet shows: the place search, or naming a pin dropped on the map. */
export type AddMode = { kind: 'search' } | { kind: 'pin'; coordinate: LngLat };

export interface AddPlaceSheetProps {
  /** Null: closed. */
  mode: AddMode | null;
  /** The trip's city: search looks around it. Null when the trip has no coordinates. */
  near: LngLat | null;
  onClose: () => void;
  onPickSpot: (spot: SpotResult) => void;
  /** "Drop a pin": closes the sheet so the user can touch and hold the map. */
  onDropPin: () => void;
  onSavePin: (name: string) => void;
  /** A save is running: buttons wait. */
  saving: boolean;
}

/** The search text, settled for `ms` (one request per pause, not per keystroke). */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Add to the Bucket List: search for a place near the trip, or name a dropped pin. */
export function AddPlaceSheet({
  mode,
  near,
  onClose,
  onPickSpot,
  onDropPin,
  onSavePin,
  saving,
}: AddPlaceSheetProps) {
  // Keep the last content while the sheet slides away; each opening starts fresh (its own key).
  const [shown, setShown] = useState<{ mode: AddMode; key: number } | null>(null);
  if (mode && shown?.mode !== mode) setShown({ mode, key: (shown?.key ?? 0) + 1 });
  const content = mode ?? shown?.mode ?? null;

  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={content?.kind === 'pin' ? 'Name this place' : 'Add to Bucket List'}
      testID="bucket-add-sheet"
    >
      {content?.kind === 'search' ? (
        <SpotSearch
          key={shown?.key}
          near={near}
          onPick={onPickSpot}
          onDropPin={onDropPin}
          saving={saving}
        />
      ) : content?.kind === 'pin' ? (
        <PinName key={shown?.key} onSave={onSavePin} saving={saving} />
      ) : null}
    </Sheet>
  );
}

export interface SpotSearchProps {
  near: LngLat | null;
  onPick: (spot: SpotResult) => void;
  /** Shows the "Drop a pin" row (Bucket List). */
  onDropPin?: () => void;
  saving: boolean;
}

/** Search for places near the trip (the `places` function); also used by the itinerary's Add. */
export function SpotSearch({ near, onPick, onDropPin, saving }: SpotSearchProps) {
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 300);
  const results = useQuery(
    {
      queryKey: ['spots', near?.lat, near?.lng, query.toLowerCase()],
      queryFn: () => searchSpots(query, near!),
      enabled: near !== null && query.length >= 2,
      staleTime: Infinity,
    },
    queryClient,
  );

  let list = null;
  if (!near) {
    list = (
      <Text variant="subhead" tone="secondary" style={styles.note}>
        This trip has no map location, so search can&apos;t look nearby.
        {onDropPin ? ' Drop a pin instead.' : ''}
      </Text>
    );
  } else if (query.length >= 2) {
    if (results.isPending) {
      list = (
        <View style={styles.skeletons} testID="spots-loading">
          <Skeleton height={20} width="60%" />
          <Skeleton height={20} width="45%" />
        </View>
      );
    } else if (results.isError) {
      list = (
        <Text variant="subhead" tone="secondary" style={styles.note}>
          Search isn&apos;t working right now. Check your connection and try again.
        </Text>
      );
    } else if (results.data.length === 0) {
      list = (
        <Text variant="subhead" tone="secondary" style={styles.note}>
          Nothing nearby matches “{query}”.
        </Text>
      );
    } else {
      list = (
        <View style={styles.group}>
          {results.data.map((spot, i) => (
            <ListRow
              key={spot.id}
              icon={pinSymbol(spot.kind ?? 'bucket')}
              title={spot.name}
              subtitle={[spot.area, kindLabel(spot.kind)].filter(Boolean).join(' · ') || undefined}
              onPress={saving ? undefined : () => onPick(spot)}
              separator={i < results.data.length - 1}
              testID={`spot-${spot.id}`}
            />
          ))}
        </View>
      );
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Icon name="magnifyingglass" size="sm" tone="secondary" />
        <BottomSheetTextInput
          value={text}
          onChangeText={setText}
          placeholder="Restaurants, bars, sights"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Search places"
          style={styles.input}
          testID="spot-input"
        />
      </View>
      {list}
      {onDropPin ? (
        <View style={styles.group}>
          <ListRow
            icon="mappin.and.ellipse"
            title="Drop a pin"
            subtitle="Touch and hold the map where it is"
            onPress={onDropPin}
            testID="bucket-drop-pin"
          />
        </View>
      ) : null}
    </View>
  );
}

function PinName({ onSave, saving }: { onSave: (name: string) => void; saving: boolean }) {
  const [name, setName] = useState('');
  const valid = name.trim().length > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Icon name="mappin" size="sm" tone="secondary" />
        <BottomSheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Viewpoint above the Strip"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => valid && !saving && onSave(name)}
          accessibilityLabel="Place name"
          style={styles.input}
          testID="pin-name-input"
        />
      </View>
      <Button
        label="Save to Bucket List"
        onPress={() => onSave(name)}
        disabled={!valid || saving}
        testID="pin-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  input: {
    ...typography.body,
    // No fixed line height in a TextInput: iOS clips the caret.
    lineHeight: undefined,
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
  },
  group: {
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  skeletons: { gap: spacing.md, padding: spacing.md },
  note: { paddingHorizontal: spacing.xs },
});
