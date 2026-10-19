import { FlightStatusPill } from '../flight/FlightStatusPill';
import { formatDateTime } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

function FlightCard({ entry, onPress, tag }: WalletCardRendererProps<'flight'>) {
  const flight = entry.booking.data;
  return (
    <WalletCard
      badge={{ code: flight.airlineCode }}
      title={`Flight to ${flight.to.city}`}
      lines={[
        `${flight.flightNumber} · ${flight.from.code} → ${flight.to.code}`,
        formatDateTime(flight.departs),
      ]}
      accessory={<FlightStatusPill flight={flight} />}
      tag={tag}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const flightCard: WalletCardDef<'flight'> = {
  label: () => 'Flight',
  Card: FlightCard,
  detailHref: (id) => `/organize/flight/${encodeURIComponent(id)}`,
};
