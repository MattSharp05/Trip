import { ListRow, Surface } from '@/ui';

/**
 * The rows under a booking's facts: directions to where it happens and its original file. Each
 * shows only when there's somewhere to go.
 */
export function BookingLinks({
  directions,
  originalPath,
  originalTitle,
  onOpen,
  onViewOriginal,
}: {
  directions: { title: string; subtitle: string | null; url: string | null } | null;
  originalPath: string | null;
  originalTitle: string;
  onOpen: (url: string) => void;
  onViewOriginal: (path: string) => void;
}) {
  const directionsUrl = directions?.url ?? null;
  if (!directionsUrl && !originalPath) return null;
  return (
    <Surface padding="none">
      {directions && directionsUrl ? (
        <ListRow
          icon="location"
          title={directions.title}
          subtitle={directions.subtitle ?? undefined}
          onPress={() => onOpen(directionsUrl)}
          separator={Boolean(originalPath)}
          testID="booking-directions"
        />
      ) : null}
      {originalPath ? (
        <ListRow
          icon="doc.text"
          title={originalTitle}
          onPress={() => onViewOriginal(originalPath)}
          testID="booking-original"
        />
      ) : null}
    </Surface>
  );
}
