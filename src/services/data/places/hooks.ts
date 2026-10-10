import { useWrite } from '../shared/query';
import type { PlaceInput } from './types';

export const useSavePlace = () => useWrite((s, place: PlaceInput) => s.savePlace(place));
