import { formatDateTime } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

function TicketCard({ entry, places, onPress, tag }: WalletCardRendererProps<'ticket'>) {
  const ticket = entry.booking.data;
  const venue = places.get(ticket.placeId)?.name;
  return (
    <WalletCard
      badge={{ icon: 'ticket' }}
      title={ticket.event}
      lines={[formatDateTime(ticket.starts), ...(venue ? [venue] : [])]}
      tag={tag}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const ticketCard: WalletCardDef<'ticket'> = {
  label: () => 'Ticket',
  Card: TicketCard,
  detailHref: (id) => `/organize/ticket/${encodeURIComponent(id)}`,
};
