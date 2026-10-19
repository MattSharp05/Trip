import { useWrite } from '../shared/query';
import type { Booking, BookingVisibility } from './types';

export const useSaveBooking = () => useWrite((s, booking: Booking) => s.saveBooking(booking));
export const useSetBookingVisibility = () =>
  useWrite((s, { id, visibility }: { id: string; visibility: BookingVisibility }) =>
    s.setBookingVisibility(id, visibility),
  );
