import type { CarData, LocalDateTime } from '@/services/data/types';

import type { FactRow } from '../details';
import { formatDateTime } from '../format';

const when = (at: LocalDateTime) => formatDateTime(at);

/** Pickup and return side by side (time, then place), then confirmation and car class. */
export function carFacts(
  car: CarData,
  pickupPlace: string | null,
  returnPlace: string | null,
): FactRow[] {
  return [
    [
      { label: 'Pickup', value: when(car.pickup), detail: pickupPlace },
      { label: 'Return', value: when(car.dropoff), detail: returnPlace },
    ],
    [{ label: 'Confirmation #', value: car.confirmation || null }],
    [{ label: 'Car class', value: car.vehicle }],
  ];
}
