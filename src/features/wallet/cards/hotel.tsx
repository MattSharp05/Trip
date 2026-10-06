import { formatDay, formatNights, nightsBetween } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

function HotelCard({ entry, onPress }: WalletCardRendererProps<'hotel'>) {
  const hotel = entry.booking.data;
  const nights = nightsBetween(hotel.checkIn.date, hotel.checkOut.date);
  return (
    <WalletCard
      badge={{ icon: 'bed.double' }}
      title={hotel.name}
      lines={[
        `${formatDay(hotel.checkIn.date)} – ${formatDay(hotel.checkOut.date)} · ${formatNights(nights)}`,
        `Confirmation ${hotel.confirmation}`,
      ]}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const hotelCard: WalletCardDef<'hotel'> = {
  label: () => 'Hotel',
  Card: HotelCard,
};
