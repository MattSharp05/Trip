import type { ParsedBooking } from '../../../supabase/functions/_shared/parse/schema';
import { firstPlannedDay, planImport } from '@/core/bookingMapping';
import { dayIn, dayLabel } from '@/core/dates';
import { newId } from '@/core/ids';
import { tripCurrencyOf } from '@/features/budget/budget';
import { withTripRate } from '@/features/budget/tripRate';
import type { BookingVisibility, DataSource, NewTrip, Trip } from '@/services/data';

export interface SaveImportInput {
  booking: ParsedBooking;
  /** The trip it goes in, or the trip to create for it. */
  target: { trip: Trip } | { create: NewTrip };
  originalPath: string | null;
  importedAt: string;
  /** Shared with the group or only you (the review screen's row); else the type's default. */
  visibility?: BookingVisibility;
}

export interface SaveImportResult {
  trip: Trip;
  /** The confirmation toast. */
  message: string;
}

/**
 * Saves a reviewed booking: the trip (when new), its places, the wallet bookings, the plan items
 * and the expense. Writes run in order; if one fails, the bookings and items already written are
 * removed again, so a failed import leaves no half-booking behind. A trip created for it stays
 * (empty; a retry then matches it), as do unused places, which nothing shows.
 */
export async function saveImport(
  source: DataSource,
  { booking, target, originalPath, importedAt, visibility }: SaveImportInput,
): Promise<SaveImportResult> {
  const created = 'create' in target;
  const trip = 'trip' in target ? target.trip : await source.createTrip(target.create);
  // A priced booking's expense is split per ADR 0030, so it needs the trip's members.
  const members = booking.price ? await source.listMembers(trip.id) : [];
  const importer = members.find((m) => m.isMe)?.id;
  const plan = planImport(booking, trip, {
    newId: () => newId(),
    originalPath,
    importedAt,
    ...(visibility ? { visibility } : {}),
    ...(importer ? { split: { importer, members: members.map((m) => m.id) } } : {}),
  });

  const bookingIds: string[] = [];
  const itemIds: string[] = [];
  try {
    for (const place of plan.places) await source.savePlace(place);
    for (const b of plan.bookings) {
      await source.createBooking(b);
      bookingIds.push(b.id);
    }
    for (const item of plan.items) {
      await source.saveItineraryItem(item);
      itemIds.push(item.id);
    }
    for (const expense of plan.expenses) {
      const day = dayIn(trip.timezone, new Date(importedAt));
      await source.saveExpense(
        await withTripRate(expense, tripCurrencyOf(trip), day, { demo: source.kind === 'demo' }),
      );
    }
  } catch (error) {
    await Promise.allSettled(itemIds.map((id) => source.deleteItineraryItem(id)));
    await Promise.allSettled(bookingIds.map((id) => source.deleteBooking(id)));
    throw error;
  }

  const day = firstPlannedDay(plan);
  const saved = created
    ? `Created your ${trip.city} trip and saved the booking.`
    : 'Saved to your wallet.';
  return {
    trip,
    message: day ? `${saved} Also added to ${dayLabel(day)} on your plan and map.` : saved,
  };
}
