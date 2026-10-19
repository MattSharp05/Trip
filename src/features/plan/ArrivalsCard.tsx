import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayMoves, hintLine, moveLabel, tripMoves, type AirportMoves } from '@/core/arrivals';
import { toMember } from '@/core/members';
import { MemberAvatar } from '@/features/members';
import { useTripFlights, useTripMembers, type Member, type TripData } from '@/services/data';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

export interface ArrivalsCardProps {
  data: Pick<TripData, 'trip' | 'places'>;
  day: string;
}

/**
 * Who lands and who leaves on the day (TR-58), at the top of the itinerary: one compact card per
 * airport, a row per traveller (initial, name, flight number, "lands 2:10 PM LAS"), and the pickup
 * hint when two of them land within an hour of each other. Only where someone else flies too: a
 * day with just your own flight (or a trip of one) shows nothing new.
 */
export function ArrivalsCard({ data, day }: ArrivalsCardProps) {
  const { trip, places } = data;
  const { data: flights } = useTripFlights(trip.id);
  const { data: members } = useTripMembers(trip.id);
  const me = members?.find((m) => m.isMe)?.id;
  const groups = useMemo(() => {
    if (!flights || !me) return [];
    const moves = dayMoves(tripMoves(flights, trip, places), day);
    // Alone on a flight, your own FlightCard and itinerary row already say it all.
    return [...moves.arrivals, ...moves.departures].filter((g) =>
      g.moves.some((m) => m.travelerId !== me),
    );
  }, [flights, me, trip, places, day]);

  if (groups.length === 0) return null;
  const memberOf = (id: string): Pick<Member, 'name' | 'initial' | 'isMe'> =>
    members?.find((m) => m.id === id) ?? toMember(id, null, 'member', false);
  return (
    <View style={styles.outer} testID="arrivals">
      {groups.map((group) => (
        <AirportCard
          key={`${group.direction}-${group.airport}`}
          group={group}
          memberOf={memberOf}
          // One airport a day is the usual case: the title then needs no code.
          titled={groups.filter((g) => g.direction === group.direction).length > 1}
        />
      ))}
    </View>
  );
}

function AirportCard({
  group,
  memberOf,
  titled,
}: {
  group: AirportMoves;
  memberOf: (id: string) => Pick<Member, 'name' | 'initial' | 'isMe'>;
  titled: boolean;
}) {
  const title = group.direction === 'arrival' ? 'Arrivals' : 'Departures';
  const testID = `${group.direction === 'arrival' ? 'arrivals' : 'departures'}-${group.airport}`;
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.titleRow}>
        <Icon
          name={group.direction === 'arrival' ? 'airplane.arrival' : 'airplane.departure'}
          tone="secondary"
          size="sm"
        />
        <Text variant="subhead" tone="secondary" style={styles.title} accessibilityRole="header">
          {titled ? `${title} · ${group.airport}` : title}
        </Text>
      </View>
      {group.moves.map((move) => {
        const member = memberOf(move.travelerId);
        const when = moveLabel(group.direction, move);
        return (
          <View
            key={move.bookingId}
            style={styles.row}
            accessible
            accessibilityLabel={`${member.name}, ${move.flightNumber}, ${when}`}
            testID={`${testID}-${move.travelerId}`}
          >
            <MemberAvatar member={member} onRaised />
            <View style={styles.who}>
              <Text variant="body" style={styles.name} numberOfLines={1}>
                {member.name}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {move.flightNumber}
              </Text>
            </View>
            <Text variant="subhead" numberOfLines={1}>
              {when}
            </Text>
          </View>
        );
      })}
      {group.hints.map((hint, i) => (
        <Text
          key={`${i}-${hint.travelerIds.join()}`}
          variant="caption"
          tone="secondary"
          style={styles.hint}
          testID={i === 0 ? `${testID}-hint` : `${testID}-hint-${i}`}
        >
          {hintLine(group, hint, (id) => memberOf(id).name)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: spacing.sm, paddingHorizontal: screenPadding, paddingBottom: spacing.sm },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  who: { flex: 1 },
  name: { fontWeight: '600' },
  hint: { paddingTop: spacing.xxs },
});
