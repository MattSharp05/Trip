import { brandCode, formatDateTime } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

function CarCard({ entry, places, onPress }: WalletCardRendererProps<'car'>) {
  const car = entry.booking.data;
  const pickupPlace = places.get(car.pickupPlaceId)?.name;
  return (
    <WalletCard
      badge={{ code: brandCode(car.company) }}
      title={`${car.company} rental car`}
      lines={[`Pickup ${formatDateTime(car.pickup)}`, ...(pickupPlace ? [pickupPlace] : [])]}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const carCard: WalletCardDef<'car'> = {
  label: () => 'Rental car',
  Card: CarCard,
};
