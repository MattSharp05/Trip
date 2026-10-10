import type { DemoStore } from '../shared/demo';
import type { MembersSource } from './types';

/** The members slice of the demo source (see `./types.ts`); empty until the members ticket. */
export function demoMembers(_store: DemoStore): MembersSource {
  return {};
}
