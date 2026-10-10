import { useWrite } from '../shared/query';
import type { SavedLinkInput } from './types';

export const useSaveLink = () => useWrite((s, link: SavedLinkInput) => s.saveLink(link));
