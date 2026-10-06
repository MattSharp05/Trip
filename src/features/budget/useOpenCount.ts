import { useState } from 'react';

/** Counts a sheet's openings: use it as a key so each opening starts with a fresh form. */
export function useOpenCount(open: boolean): number {
  const [count, setCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  // Adjusting state while rendering (React's pattern for reacting to a prop change).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount(count + 1);
  }
  return count;
}
