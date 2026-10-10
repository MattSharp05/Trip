import { useWrite } from '../shared/query';
import type { Booking } from './types';

export const useSaveBooking = () => useWrite((s, booking: Booking) => s.saveBooking(booking));
