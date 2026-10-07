import { useCallback, useMemo, useState } from 'react';

import { dayLabel } from '@/core/dates';
import { newId } from '@/core/ids';
import { DEFAULT_DURATION_MIN } from '@/core/reflow';
import { placeFromSpot } from '@/features/bucket';
import type { LngLat } from '@/features/map';
import { useSavePlace, type ItineraryItem, type TripData } from '@/services/data';
import type { SpotResult } from '@/services/places';
import { Sheet } from '@/ui';

import { AddStop } from './AddStopSheet';
import { ItemDetails } from './DetailSheet';
import type { ItineraryEditing } from './EditableRow';
import {
  itemTitle,
  kindForPlace,
  lockedReason,
  planAdd,
  planReorder,
  planUpdate,
  suggestedStart,
  type EditPlan,
} from './edits';
import { DayPick, TimePick } from './TimeSheet';
import { useItineraryEdits } from './useItineraryEdits';

type EditorSheet = { kind: 'time' | 'move' | 'details'; itemId: string } | { kind: 'add' };

const SHEET_TITLES: Record<EditorSheet['kind'], string> = {
  time: 'Change time',
  move: 'Move to another day',
  details: 'Edit stop',
  add: 'Add a stop',
};

export interface ItineraryEditorOptions {
  data: TripData | null | undefined;
  /** The day the timeline shows. */
  day: string | null;
  /** Every day of the trip (Move to another day). */
  days: string[];
  /** The trip's city, for place search. */
  near: LngLat | null;
}

/**
 * Editing the Plan tab's itinerary: the gestures for `Itinerary` (`editing`), the day header's
 * Add (`add`), the toast to show, and the sheets to draw (`sheets`).
 */
export function useItineraryEditor({ data, day, days, near }: ItineraryEditorOptions) {
  const edits = useItineraryEdits(data?.trip.id ?? null);
  const { run, showMessage, remove } = edits;
  const { mutateAsync: savePlace } = useSavePlace();
  const [sheet, setSheet] = useState<EditorSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep the last content while the sheet slides away; each opening starts fresh (its own key).
  const [shown, setShown] = useState<{ sheet: EditorSheet; key: number } | null>(null);
  if (sheet && shown?.sheet !== sheet) setShown({ sheet, key: (shown?.key ?? 0) + 1 });

  const open = useCallback((next: EditorSheet) => {
    setError(null);
    setSheet(next);
  }, []);
  const close = useCallback(() => {
    setSheet(null);
    setError(null);
  }, []);

  const find = useCallback((id: string) => data?.items.find((item) => item.id === id), [data]);

  const editing = useMemo((): ItineraryEditing => {
    /** Open a time or day sheet, unless a booking sets the item's time. */
    const openTiming = (kind: 'time' | 'move') => (id: string) => {
      const item = find(id);
      if (!item || !data) return;
      const locked = lockedReason(data, item);
      if (locked) showMessage(locked);
      else open({ kind, itemId: id });
    };
    return {
      onReorder: (from, to) => {
        if (!data || !day) return false;
        const plan = planReorder(data, day, from, to);
        return run(plan) && 'edit' in plan && plan.edit.save.length > 0;
      },
      onTimePress: openTiming('time'),
      onMoveDay: openTiming('move'),
      onEdit: (id) => open({ kind: 'details', itemId: id }),
      onDelete: (id) => {
        const item = find(id);
        if (item && data) remove(item, itemTitle(data, item));
      },
    };
  }, [data, day, find, open, run, showMessage, remove]);

  /** Run a plan from a sheet: close it, or say inside it why not. */
  const submit = useCallback(
    (plan: EditPlan, done?: string) => {
      if ('message' in plan) setError(plan.message);
      else {
        run(plan, done);
        close();
      }
    },
    [run, close],
  );

  const saveTime = (item: ItineraryItem, time: string) =>
    data && submit(planUpdate(data, { ...item, startTime: time }));

  const moveToDay = (item: ItineraryItem, to: string) =>
    data &&
    submit(
      planUpdate(data, { ...item, day: to }),
      `Moved ${itemTitle(data, item)} to ${dayLabel(to)}`,
    );

  /** Saves a newly picked place first: the item needs its id. */
  const withPlace = async (spot: SpotResult, save: (placeId: string) => EditPlan) => {
    setSaving(true);
    try {
      const place = await savePlace(placeFromSpot(spot));
      const plan = save(place.id);
      return 'edit' in plan ? { edit: { ...plan.edit, place } } : plan;
    } catch {
      return { message: "Couldn't save that place. Try again." };
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async (next: ItineraryItem, spot: SpotResult | null) => {
    if (!data) return;
    if (!spot) return submit(planUpdate(data, next));
    // Check the time before saving the place, so a refused edit leaves nothing behind.
    const check = planUpdate(data, next);
    if ('message' in check) return setError(check.message);
    submit(await withPlace(spot, (placeId) => planUpdate(data, { ...next, placeId })));
  };

  const addStop = async (spot: SpotResult, time: string) => {
    if (!data || !day) return;
    const item: ItineraryItem = {
      id: newId(),
      tripId: data.trip.id,
      day,
      startTime: time,
      durationMinutes: DEFAULT_DURATION_MIN,
      placeId: null,
      kind: kindForPlace(spot.kind),
      bookingId: null,
      fixed: false,
      title: spot.name,
    };
    const check = planAdd(data, item);
    if ('message' in check) return setError(check.message);
    submit(
      await withPlace(spot, (placeId) => planAdd(data, { ...item, placeId })),
      `Added ${spot.name} to ${dayLabel(day)}`,
    );
  };

  const content = shown?.sheet;
  const item = content && content.kind !== 'add' ? find(content.itemId) : undefined;
  let body = null;
  if (content?.kind === 'add' && data && day) {
    body = (
      <AddStop
        key={shown?.key}
        day={day}
        near={near}
        suggestedTime={suggestedStart(data, day)}
        error={error}
        saving={saving}
        onAdd={addStop}
      />
    );
  } else if (item && data) {
    if (content?.kind === 'time') {
      body = (
        <TimePick
          key={shown?.key}
          time={item.startTime}
          error={error}
          onSave={(time) => saveTime(item, time)}
        />
      );
    } else if (content?.kind === 'move') {
      body = (
        <DayPick
          key={shown?.key}
          days={days}
          current={item.day}
          error={error}
          onPick={(to) => moveToDay(item, to)}
        />
      );
    } else if (content?.kind === 'details') {
      body = (
        <ItemDetails
          key={shown?.key}
          item={item}
          placeName={data.places.find((p) => p.id === item.placeId)?.name ?? null}
          booked={item.bookingId !== null}
          near={near}
          error={error}
          saving={saving}
          onSave={saveDetails}
        />
      );
    }
  }

  return {
    editing,
    add: useCallback(() => open({ kind: 'add' }), [open]),
    toast: edits.toast,
    undo: edits.undo,
    dismissToast: edits.dismissToast,
    sheets: (
      <Sheet
        open={sheet !== null}
        onClose={close}
        title={content ? SHEET_TITLES[content.kind] : undefined}
        testID="itinerary-edit-sheet"
      >
        {body}
      </Sheet>
    ),
  };
}
