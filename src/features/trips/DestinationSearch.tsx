import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { queryClient } from '@/services/data';
import { searchPlaces, type PlaceResult } from '@/services/places';
import { colors, continuous, radii, spacing, typography } from '@/theme';
import { Icon, ListRow, Skeleton, Text } from '@/ui';

import { placeLabel } from './newTrip';

/** The search text, settled for `ms` (one request per pause, not per keystroke). */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Type a city, pick it from the `places` results (Photon). */
export function DestinationSearch({ onPick }: { onPick: (place: PlaceResult) => void }) {
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 300);
  const results = useQuery(
    {
      queryKey: ['places', query.toLowerCase()],
      queryFn: () => searchPlaces(query),
      enabled: query.length >= 2,
      staleTime: Infinity,
    },
    queryClient,
  );

  let list = null;
  if (query.length >= 2) {
    if (results.isPending) {
      list = (
        <View style={styles.skeletons} testID="destination-loading">
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
          No cities match “{query}”.
        </Text>
      );
    } else {
      list = (
        <View style={styles.results}>
          {results.data.map((place, i) => (
            <ListRow
              key={place.id}
              icon="mappin.and.ellipse"
              title={place.name}
              subtitle={[place.region, place.country].filter(Boolean).join(', ')}
              onPress={() => onPick(place)}
              separator={i < results.data.length - 1}
              testID={`destination-${place.id}`}
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
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search for a city"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Destination"
          style={styles.input}
          testID="destination-input"
        />
      </View>
      {list}
    </View>
  );
}

/** The picked destination, with a way back to the search. */
export function PickedDestination({
  place,
  onChange,
}: {
  place: PlaceResult;
  onChange: () => void;
}) {
  return (
    <View style={styles.results}>
      <ListRow
        icon="mappin.and.ellipse"
        title={place.name}
        subtitle={placeLabel(place)}
        value="Change"
        valueTone="accent"
        onPress={onChange}
        testID="destination-picked"
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
    backgroundColor: colors.raised,
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
  results: {
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
