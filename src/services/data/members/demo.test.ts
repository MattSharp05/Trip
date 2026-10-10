import { BLAKE, groupSnapshot, WILLEM } from '@/scenarios/fixtures/group';
import { ME, vegasSnapshot } from '@/scenarios/fixtures/vegas';

import { createDemoSource } from '../source';

const VEGAS = 'trip-vegas';
const names = async (source: ReturnType<typeof createDemoSource>, tripId = VEGAS) =>
  (await source.listMembers(tripId)).map((m) => m.name);

describe('demo members', () => {
  it('lists the snapshot members, you first', async () => {
    expect(await names(createDemoSource(groupSnapshot))).toEqual(['Matthew', 'Blake', 'Willem']);
    expect(await createDemoSource(vegasSnapshot).listMembers(VEGAS)).toEqual([
      { id: ME, name: 'Matthew', initial: 'M', role: 'owner', isMe: true },
    ]);
  });

  it('reads and saves your profile', async () => {
    const source = createDemoSource(groupSnapshot);
    expect(await source.getMyProfile()).toEqual({ id: ME, displayName: 'Matthew' });
    await source.saveMyProfile({ displayName: ' Matt ', venmo: 'matt-v', zelle: ' ' });
    expect(await source.getMyProfile()).toEqual({ id: ME, displayName: 'Matt', venmo: 'matt-v' });
    expect(await names(source)).toEqual(['Matt', 'Blake', 'Willem']);
    await expect(source.saveMyProfile({ displayName: '  ' })).rejects.toThrow('A name is required');
  });

  it('lets the owner remove a member, whose private bookings go and whose items stay', async () => {
    const source = createDemoSource({
      ...groupSnapshot,
      bookings: [
        ...groupSnapshot.bookings,
        { ...groupSnapshot.bookings[0], id: 'booking-blake-flight', addedBy: BLAKE },
      ],
    });
    await source.removeMember(VEGAS, BLAKE);
    expect(await names(source)).toEqual(['Matthew', 'Willem']);
    const data = (await source.getTripData(VEGAS))!;
    expect(data.bookings.map((b) => b.id)).not.toContain('booking-blake-flight');
    expect(data.bookings).toHaveLength(groupSnapshot.bookings.length);
    expect(data.bucketItems.find((b) => b.id === 'bucket-golden-tiki')?.addedBy).toBe(BLAKE);
  });

  it('never removes the owner, and only the owner removes anyone', async () => {
    await expect(createDemoSource(groupSnapshot).removeMember(VEGAS, ME)).rejects.toThrow();
    const asBlake = createDemoSource({ ...groupSnapshot, me: BLAKE });
    await expect(asBlake.removeMember(VEGAS, WILLEM)).rejects.toThrow(
      'Only the owner can remove members',
    );
  });

  it('lets a member leave: the trip disappears from their trips', async () => {
    const asWillem = createDemoSource({ ...groupSnapshot, me: WILLEM });
    expect((await asWillem.listTrips()).map((t) => t.id)).toEqual([VEGAS]);
    await asWillem.leaveTrip(VEGAS);
    expect(await asWillem.listTrips()).toEqual([]);
    expect(await asWillem.getTripData(VEGAS)).toBeNull();
    await expect(asWillem.leaveTrip(VEGAS)).rejects.toThrow('Not a member');
  });

  it('keeps the owner on the trip', async () => {
    await expect(createDemoSource(groupSnapshot).leaveTrip(VEGAS)).rejects.toThrow(
      'The owner can’t leave the trip',
    );
  });

  it('hides other members’ private bookings, as RLS does', async () => {
    const source = createDemoSource({
      ...groupSnapshot,
      bookings: [
        ...groupSnapshot.bookings,
        { ...groupSnapshot.bookings[0], id: 'booking-blake-flight', addedBy: BLAKE },
        {
          ...groupSnapshot.bookings[0],
          id: 'booking-willem-shared',
          addedBy: WILLEM,
          visibility: 'shared',
        },
      ],
    });
    const ids = (await source.getTripData(VEGAS))!.bookings.map((b) => b.id);
    expect(ids).not.toContain('booking-blake-flight');
    expect(ids).toContain('booking-willem-shared');
  });

  it('makes you the owner of a trip you create, and drops members with a deleted trip', async () => {
    const source = createDemoSource({ ...vegasSnapshot, trips: [], members: [] });
    const trip = await source.createTrip({
      city: 'Lisbon',
      country: 'Portugal',
      lat: 38.7,
      lng: -9.1,
      timezone: 'Europe/Lisbon',
      startDate: '2027-05-01',
      endDate: '2027-05-05',
      coverPhotoUrl: null,
    });
    expect(await source.listMembers(trip.id)).toEqual([
      { id: ME, name: 'Matthew', initial: 'M', role: 'owner', isMe: true },
    ]);
    await source.deleteTrip(trip.id);
    expect(await source.listMembers(trip.id)).toEqual([]);
  });
});
