import type { DataSnapshot, Membership, Profile } from '@/services/data/types';

import { VEGAS_TRIP_ID, vegasSnapshot } from './vegas';

/**
 * The Vegas trip as a group trip (v2, PRD decision 8): Matthew ("you", the owner) with two
 * pretend travelers, Blake and Willem, so splits, likes and opt-outs can be tested alone. Later
 * group tickets add their flights, likes, opt-outs and expenses here.
 */

export const BLAKE = 'user-blake';
export const WILLEM = 'user-willem';

const profiles: Profile[] = [
  ...vegasSnapshot.profiles,
  { id: BLAKE, displayName: 'Blake', venmo: 'blake-demo' },
  { id: WILLEM, displayName: 'Willem', cashapp: '$willemdemo', zelle: 'willem@example.com' },
];

const members: Membership[] = [
  ...vegasSnapshot.members,
  { tripId: VEGAS_TRIP_ID, userId: BLAKE, role: 'member' },
  { tripId: VEGAS_TRIP_ID, userId: WILLEM, role: 'member' },
];

/** Who added what, beyond Matthew's own (unmarked) items. */
const BUCKET_ADDED_BY: Record<string, string> = { 'bucket-golden-tiki': BLAKE };
const STOP_ADDED_BY: Record<string, string> = { 'Dinner at Peppermill': WILLEM };

export const groupSnapshot: DataSnapshot = {
  ...vegasSnapshot,
  members,
  profiles,
  bucketItems: vegasSnapshot.bucketItems.map((b) =>
    BUCKET_ADDED_BY[b.id] ? { ...b, addedBy: BUCKET_ADDED_BY[b.id] } : b,
  ),
  items: vegasSnapshot.items.map((i) =>
    i.title && STOP_ADDED_BY[i.title] ? { ...i, addedBy: STOP_ADDED_BY[i.title] } : i,
  ),
};
