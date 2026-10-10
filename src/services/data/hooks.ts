// Every domain's React Query hooks, plus the shared client and query keys. A new hook in a
// domain's `hooks.ts` is exported from here (and `@/services/data`) without touching this file.
export { dataKeys, queryClient } from './shared/query';
export * from './bookings/hooks';
export * from './bucket/hooks';
export * from './documents/hooks';
export * from './expenses/hooks';
export * from './itinerary/hooks';
export * from './links/hooks';
export * from './members/hooks';
export * from './places/hooks';
export * from './trips/hooks';
