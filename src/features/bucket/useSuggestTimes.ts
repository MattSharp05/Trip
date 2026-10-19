import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDataSource, type DataSource, type TripData } from '@/services/data';
import { useScenarioStore } from '@/stores/scenario';

import { bucketSuggestions, hasLikedItems } from './suggest';

/** The demo session whose scenario sheet has been opened and closed: it opens once per load. */
let usedBy: DataSource | null = null;

/**
 * The Suggest times sheet's state (TR-64): open or not, the items skipped while it's open, and the
 * rows, worked out again from the trip each time it changes. `canSuggest` shows the button. A
 * scenario (`suggestTimes`) opens it once the trip has loaded; closing the sheet it opened uses it
 * up.
 */
export function useSuggestTimes(data: TripData | null | undefined) {
  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(
    () => (open && data ? bucketSuggestions(data, skipped) : []),
    [open, data, skipped],
  );

  const show = useCallback(() => {
    setSkipped(new Set());
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  /** Skip leaves the item out; skipping the last one that fits closes the sheet. */
  const skip = useCallback(
    (bucketId: string) => {
      const next = new Set([...skipped, bucketId]);
      setSkipped(next);
      if (!data || !bucketSuggestions(data, next).some((row) => row.suggestion)) setOpen(false);
    },
    [data, skipped],
  );

  const source = useDataSource();
  const opened = useRef<DataSource | null>(null);
  const shown = useRef(false);
  useEffect(() => {
    const { view } = useScenarioStore.getState();
    if (!view.suggestTimes || source.kind !== 'demo' || !data || !hasLikedItems(data)) return;
    if (opened.current === source || usedBy === source) return;
    opened.current = source;
    show();
  }, [data, source, show]);
  useEffect(() => {
    if (opened.current !== source) return;
    if (open) shown.current = true;
    // Not by clearing the scenario's view: that starts the selection over (stores/selection).
    else if (shown.current) usedBy = source;
  }, [open, source]);

  return {
    open: open,
    rows,
    show,
    close,
    skip,
    canSuggest: data ? hasLikedItems(data) : false,
  };
}
