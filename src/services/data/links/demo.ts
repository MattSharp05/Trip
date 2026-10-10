import { copy, type DemoStore } from '../shared/demo';
import type { LinksSource } from './types';

/** The saved links slice of the demo source. */
export function demoLinks(_store: DemoStore): LinksSource {
  let linkCount = 0;
  return {
    async saveLink(input) {
      // Demo links live on the bucket items that point at them; nothing else lists them.
      return copy({ ...input, id: input.id ?? `link-${Date.now().toString(36)}-${++linkCount}` });
    },
  };
}
