import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { LinkResult } from '../../../supabase/functions/_shared/parse/links';
import { newBucketItem } from '@/features/bucket/bucket';
import {
  queryClient,
  useDataSource,
  useSaveBucketItem,
  useSaveLink,
  useSavePlace,
  type Place,
} from '@/services/data';
import type { LinkTripArea } from '@/services/parseLink';
import type { SpotResult } from '@/services/places';

import {
  initialTicks,
  linkPlaceFromSpot,
  linkRow,
  linkRows,
  placeFromLink,
  savedLinkFrom,
  type LinkRow,
} from './links';
import { readLink } from './readLink';

/** "Find it" for an unlocated row, or "Search" for a place the video didn't name (`new`). */
export type Finding = { key: string; query: string } | null;

export interface LinkToast {
  message: string;
  /** Never: saving from a video has no Undo (delete the rows instead). */
  undo?: undefined;
}

/**
 * A pasted TikTok or Reel, from reading it to saving the ticked places on the Bucket List. The
 * Plan screen draws the results sheet and the toast from what this returns.
 */
export function useLinkFlow(tripId: string | null, area: LinkTripArea, onSaved?: () => void) {
  const source = useDataSource();
  const { mutateAsync: savePlace } = useSavePlace();
  const { mutateAsync: saveLink } = useSaveLink();
  const { mutateAsync: saveItem } = useSaveBucketItem();
  const [text, setText] = useState<string | null>(null);
  const [edits, setEdits] = useState<{ rows: LinkRow[]; ticked: Set<string> } | null>(null);
  const [finding, setFinding] = useState<Finding>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<LinkToast | null>(null);

  const read = useQuery(
    {
      queryKey: ['link', source.id, text, area.near?.lat, area.near?.lng],
      queryFn: () => readLink(source, text ?? '', area),
      enabled: text !== null,
      retry: false,
      staleTime: Infinity,
    },
    queryClient,
  );
  const result: LinkResult | undefined = text !== null ? read.data : undefined;

  // Rows and ticks start from the answer; "Find it" and the checkboxes edit them.
  const base = useMemo(() => {
    if (!result) return null;
    const rows = linkRows(result);
    return { rows, ticked: initialTicks(rows) };
  }, [result]);
  const current = edits ?? base;

  const open = useCallback((pasted: string) => {
    setEdits(null);
    setFinding(null);
    setText(pasted);
  }, []);
  const close = useCallback(() => {
    setText(null);
    setFinding(null);
  }, []);

  const toggle = useCallback(
    (key: string) => {
      if (!current) return;
      const ticked = new Set(current.ticked);
      if (ticked.has(key)) ticked.delete(key);
      else ticked.add(key);
      setEdits({ rows: current.rows, ticked });
    },
    [current],
  );

  const pickFound = useCallback(
    (spot: SpotResult) => {
      if (!current || !finding) return;
      const place = linkPlaceFromSpot(spot);
      const key = finding.key === 'new' ? `found-${current.rows.length}` : finding.key;
      const rows =
        finding.key === 'new'
          ? [...current.rows, linkRow(key, place)]
          : current.rows.map((r) => (r.key === key ? linkRow(key, place) : r));
      setEdits({ rows, ticked: new Set(current.ticked).add(key) });
      setFinding(null);
    },
    [current, finding],
  );

  const save = useCallback(async () => {
    if (!tripId || !result || !current) return;
    const chosen = current.rows.filter((r) => r.located && current.ticked.has(r.key));
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      const places: Place[] = [];
      for (const row of chosen) places.push(await savePlace(placeFromLink(row.place, result.url)));
      const link = await saveLink(
        savedLinkFrom(
          result,
          tripId,
          places.map((p) => p.id),
        ),
      );
      for (const place of places) {
        await saveItem(newBucketItem(tripId, place, result.platform, undefined, link));
      }
      setText(null);
      setToast({
        message:
          places.length === 1
            ? `Added ${places[0].name} to your Bucket List`
            : `Added ${places.length} places to your Bucket List`,
      });
      onSaved?.();
    } catch {
      setToast({ message: "Couldn't save those places. Try again." });
    } finally {
      setSaving(false);
    }
  }, [tripId, result, current, savePlace, saveLink, saveItem, onSaved]);

  return {
    open,
    close,
    isOpen: text !== null,
    loading: text !== null && read.isPending,
    error: text !== null ? read.error : null,
    retry: read.refetch,
    result,
    rows: current?.rows,
    ticked: current?.ticked,
    toggle,
    finding,
    find: setFinding,
    pickFound,
    save,
    saving,
    toast,
    dismissToast: useCallback(() => setToast(null), []),
  };
}

export type LinkFlow = ReturnType<typeof useLinkFlow>;
