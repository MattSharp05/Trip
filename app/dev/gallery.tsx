import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenPadding, spacing } from '@/theme';
import {
  Button,
  Chip,
  Icon,
  IconButton,
  ListRow,
  PhotoCard,
  Segmented,
  Sheet,
  Skeleton,
  Surface,
  Text,
  Toast,
} from '@/ui';

const FILTERS = ['All', 'Flights', 'Hotels', 'Cars', 'Tickets'] as const;
const SEGMENTS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="subhead" tone="secondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/** Every design-system component in its states, to check against the reference mockup. */
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['value']>('upcoming');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [undone, setUndone] = useState(false);
  const hideToast = useCallback(() => setToastVisible(false), []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
      >
        <Section title="Type">
          <Text variant="largeTitle">My Trips</Text>
          <Text variant="title">Sat, Oct 18</Text>
          <Text variant="headline">Breakfast at Buvette</Text>
          <Text variant="body">42 Grove St, New York</Text>
          <Text variant="subhead" tone="secondary">
            Oct 16 – Oct 20, 2026
          </Text>
          <Text variant="caption" tone="secondary">
            Nov 14 · 8:00 PM
          </Text>
          <Text variant="headline" tone="ok">
            On time
          </Text>
        </Section>

        <Section title="Icons">
          <View style={styles.row}>
            <Icon name="airplane" />
            <Icon name="bed.double" />
            <Icon name="car" />
            <Icon name="ticket" />
            <Icon name="fork.knife" tone="secondary" />
            <Icon name="sun.max" tone="secondary" />
            <Icon name="mappin.and.ellipse" selected />
          </View>
        </Section>

        <Section title="Segmented">
          <Segmented segments={SEGMENTS} value={segment} onChange={setSegment} />
        </Section>

        <Section title="Chips">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {FILTERS.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={label === filter}
                  onPress={() => setFilter(label)}
                />
              ))}
            </View>
          </ScrollView>
        </Section>

        <Section title="Buttons">
          <Button label="View Boarding Pass" icon="qrcode" onPress={() => setSheetOpen(true)} />
          <Button label="Add to Calendar" variant="secondary" icon="calendar" />
          <Button label="Saving" disabled />
          <View style={styles.row}>
            <IconButton icon="plus" label="Add trip" variant="filled" size="lg" />
            <IconButton icon="chevron.right" label="Open" />
            <IconButton icon="location" label="My location" />
            <IconButton icon="ellipsis" label="More" variant="plain" />
            <IconButton icon="heart" label="Saved" variant="plain" selected />
          </View>
        </Section>

        <Section title="Photo cards">
          <PhotoCard
            source={require('../../assets/sample/nyc.jpg')}
            title="New York"
            subtitle="Oct 16 – Oct 20, 2026"
            onPress={() => {}}
          />
          <PhotoCard
            source={require('../../assets/sample/vegas.jpg')}
            title="Las Vegas"
            subtitle="Nov 12 – Nov 16, 2026"
            onPress={() => {}}
          />
          <PhotoCard
            source={require('../../assets/sample/cape.jpg')}
            title="Cape Town"
            subtitle="Dec 18 – Jan 6, 2027"
          />
        </Section>

        <Section title="List rows">
          <Surface padding="none">
            <ListRow
              icon="airplane"
              title="Flight to New York"
              subtitle="AA 100 · JFK → LHR · Oct 17, 7:30 PM"
              onPress={() => {}}
              separator
            />
            <ListRow
              icon="bed.double"
              title="The Standard, High Line"
              subtitle="Oct 17 – Oct 20 · 3 nights"
              onPress={() => {}}
              separator
            />
            <ListRow icon="fork.knife" title="Food & Drinks" value="$218" onPress={() => {}} />
          </Surface>
          <Surface>
            <View style={styles.between}>
              <Text variant="headline">AA 100</Text>
              <Text variant="subhead" tone="ok">
                On time
              </Text>
            </View>
            <Text variant="subhead" tone="secondary">
              JFK to LHR · Fri, Oct 17
            </Text>
          </Surface>
        </Section>

        <Section title="Loading">
          <Surface style={styles.skeletonCard}>
            <Skeleton height={20} width="60%" />
            <Skeleton height={14} width="40%" />
            <Skeleton height={120} radius="photo" />
          </Surface>
        </Section>

        <Section title="Sheet and toast">
          <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
          <Button
            label="Show toast"
            variant="secondary"
            onPress={() => {
              setUndone(false);
              setToastVisible(true);
            }}
          />
          {undone ? (
            <Text variant="subhead" tone="secondary">
              Undone
            </Text>
          ) : null}
        </Section>
      </ScrollView>

      <View style={[styles.toastSlot, { bottom: insets.bottom + spacing.lg }]}>
        <Toast
          visible={toastVisible}
          message="Added to Day 3 at 2:00 PM"
          actionLabel="Undo"
          onAction={() => setUndone(true)}
          onDismiss={hideToast}
        />
      </View>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Fri, Nov 14">
        <Surface padding="none">
          <ListRow icon="sun.max" title="75° / 55°" subtitle="Sunny" separator />
          <ListRow icon="fork.knife" title="Brunch at Mon Ami Gabi" subtitle="10:00 AM" />
        </Surface>
        <Button label="Done" onPress={() => setSheetOpen(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: screenPadding, gap: spacing.xxxl },
  section: { gap: spacing.md },
  sectionTitle: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonCard: { gap: spacing.sm },
  toastSlot: { position: 'absolute', left: screenPadding, right: screenPadding },
});
