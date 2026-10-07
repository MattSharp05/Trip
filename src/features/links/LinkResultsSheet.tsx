import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { NOTHING_FOUND_COPY } from '../../../supabase/functions/_shared/parse/links';
import { SpotSearch } from '@/features/bucket/AddPlaceSheet';
import type { LngLat } from '@/features/map';
import { LinkError } from '@/services/parseLink';
import { colors, continuous, radii, spacing } from '@/theme';
import { Button, Icon, Sheet, Skeleton, Text } from '@/ui';

import { platformName, type LinkRow } from './links';
import { linkErrorMessage } from './readLink';
import type { LinkFlow } from './useLinkFlow';
import { watchLink } from './watch';

export interface LinkResultsSheetProps {
  flow: LinkFlow;
  /** The trip's city: "Find it" searches around it. */
  near: LngLat | null;
}

const THUMB_WIDTH = 54;
const THUMB_HEIGHT = 72;

/**
 * The places found in a TikTok or Reel: the video (thumbnail, caption, Watch), its places with
 * checkboxes (located ones ticked), "Find it" for the ones the map couldn't place, and "Save to
 * Bucket List".
 */
export function LinkResultsSheet({ flow, near }: LinkResultsSheetProps) {
  const { result, finding } = flow;
  const title = finding
    ? 'Find a place'
    : result
      ? `From ${platformName(result.platform)}`
      : flow.error
        ? 'Add from a video'
        : 'Finding places';

  let content;
  if (finding) {
    content = (
      <SpotSearch
        key={finding.key}
        near={near}
        initialQuery={finding.query}
        onPick={flow.pickFound}
        saving={false}
      />
    );
  } else if (flow.loading) {
    content = <Loading />;
  } else if (flow.error || !result) {
    const code = flow.error instanceof LinkError ? flow.error.code : 'failed';
    const retryable = code === 'failed' || code === 'rate_limited';
    content = (
      <View style={styles.wrap} testID="link-error">
        <Text variant="body" tone="secondary">
          {linkErrorMessage(flow.error)}
        </Text>
        {retryable ? (
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => flow.retry()}
            testID="link-retry"
          />
        ) : null}
        <Button
          label="Search for a place"
          variant={retryable ? 'secondary' : 'primary'}
          onPress={() => flow.find({ key: 'new', query: '' })}
          testID="link-search"
        />
      </View>
    );
  } else {
    const rows = flow.rows ?? [];
    const ticked = flow.ticked ?? new Set<string>();
    const count = rows.filter((r) => r.located && ticked.has(r.key)).length;
    content = (
      <View style={styles.wrap}>
        <View style={styles.video} testID="link-video">
          <View style={styles.thumb}>
            {result.thumbnailUrl ? (
              <Image source={{ uri: result.thumbnailUrl }} style={styles.photo} />
            ) : null}
            <View style={result.thumbnailUrl ? styles.playOnPhoto : undefined}>
              <Icon
                name="play.fill"
                size="sm"
                tone={result.thumbnailUrl ? 'primary' : 'secondary'}
              />
            </View>
          </View>
          <View style={styles.videoText}>
            <Text variant="subhead" numberOfLines={3}>
              {result.title ?? `A video on ${platformName(result.platform)}`}
            </Text>
            {result.author ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {result.author}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Watch on ${platformName(result.platform)}`}
            onPress={() => watchLink(result.url)}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.watch, pressed && styles.pressed]}
            testID="link-watch"
          >
            <Icon name="play.fill" size="sm" />
            <Text variant="subhead" style={styles.watchLabel}>
              Watch
            </Text>
          </Pressable>
        </View>
        {rows.length === 0 ? (
          <Text variant="body" tone="secondary" testID="link-nothing-found">
            {NOTHING_FOUND_COPY}
          </Text>
        ) : (
          <View style={styles.group}>
            {rows.map((row, i) => (
              <PlaceRow
                key={row.key}
                row={row}
                ticked={ticked.has(row.key)}
                onToggle={() => flow.toggle(row.key)}
                onFind={() => flow.find({ key: row.key, query: row.title })}
                separator={i < rows.length - 1}
              />
            ))}
          </View>
        )}
        {rows.length === 0 ? (
          <Button
            label="Search for a place"
            onPress={() => flow.find({ key: 'new', query: '' })}
            testID="link-search"
          />
        ) : (
          <Button
            label="Save to Bucket List"
            onPress={flow.save}
            disabled={count === 0 || flow.saving}
            testID="link-save"
          />
        )}
      </View>
    );
  }

  return (
    <Sheet open={flow.isOpen} onClose={flow.close} title={title} testID="link-sheet">
      {content}
    </Sheet>
  );
}

function PlaceRow({
  row,
  ticked,
  onToggle,
  onFind,
  separator,
}: {
  row: LinkRow;
  ticked: boolean;
  onToggle: () => void;
  onFind: () => void;
  separator: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={row.located ? 'checkbox' : 'button'}
      accessibilityState={row.located ? { checked: ticked } : undefined}
      accessibilityLabel={`${row.title}, ${row.subtitle}`}
      accessibilityHint={row.located ? undefined : 'Search for it near the trip'}
      onPress={row.located ? onToggle : onFind}
      style={({ pressed }) => [
        styles.row,
        separator && styles.separator,
        pressed && styles.pressed,
      ]}
      testID={`link-place-${row.key}`}
    >
      {row.located ? (
        <Icon
          name={ticked ? 'checkmark.circle.fill' : 'circle'}
          size="lg"
          tone={ticked ? 'accent' : 'secondary'}
        />
      ) : (
        <Icon name="magnifyingglass" size="lg" tone="secondary" />
      )}
      <View style={styles.rowText}>
        <Text variant="body" numberOfLines={1} style={styles.rowTitle}>
          {row.title}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          {row.subtitle}
        </Text>
      </View>
      {row.located ? (
        <Icon name={row.symbol} size="md" tone="secondary" />
      ) : (
        <Text variant="subhead" tone="accent" style={styles.findIt}>
          Find it
        </Text>
      )}
    </Pressable>
  );
}

function Loading() {
  return (
    <View style={styles.wrap} testID="link-loading">
      <View style={styles.video}>
        <Skeleton width={THUMB_WIDTH} height={THUMB_HEIGHT} radius="sm" />
        <View style={styles.videoText}>
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="60%" />
        </View>
      </View>
      <View style={styles.skeletons}>
        <Skeleton height={20} width="70%" />
        <Skeleton height={20} width="55%" />
        <Skeleton height={20} width="62%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  video: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radii.sm,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  playOnPhoto: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { flex: 1, gap: spacing.xxs },
  watch: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  watchLabel: { fontWeight: '600' },
  group: {
    borderRadius: radii.card,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  pressed: { backgroundColor: colors.fill },
  rowText: { flex: 1, gap: spacing.xxs },
  rowTitle: { fontWeight: '600' },
  findIt: { fontWeight: '600' },
  skeletons: { gap: spacing.md, padding: spacing.md },
});
