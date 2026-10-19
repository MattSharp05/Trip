import { useMemo } from 'react';

import { travelerLegs } from '@/core/flights';
import { toMember } from '@/core/members';
import type { TravelerArc } from '@/features/map/globe';
import { useTripFlights, type Member, type TripData } from '@/services/data';

/**
 * The other travellers' legs into and out of the trip's city on `day`, for the flight globe
 * (TR-63): the same legs the Arrivals card lists, minus your own (the globe draws yours from your
 * booking, with the plane). Empty on a trip of one, or until the flights have loaded.
 */
export function useTravelerArcs(
  data: Pick<TripData, 'trip' | 'places'> | null | undefined,
  day: string | null,
  members: readonly Member[] | undefined,
): TravelerArc[] {
  const { data: flights } = useTripFlights(data?.trip.id ?? null);
  return useMemo(() => {
    const me = members?.find((m) => m.isMe)?.id;
    if (!data || !day || !flights || !me) return [];
    return travelerLegs(flights, data.trip, data.places, day)
      .filter((leg) => leg.travelerId !== me)
      .map((leg) => {
        const member =
          members.find((m) => m.id === leg.travelerId) ??
          toMember(leg.travelerId, null, 'member', false);
        return { ...leg, name: member.name, initial: member.initial };
      });
  }, [data, day, flights, members]);
}
