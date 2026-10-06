import {
  BookingDetailScreen,
  BookingHeader,
  BookingLinks,
  destinationOf,
  directionsUrl,
  Facts,
  useBooking,
  useLinkActions,
} from '../details';
import { ticketFacts } from './ticketInfo';

/** An event ticket or reservation: what, when, the venue with directions, seats, confirmation. */
export function TicketDetail({ id }: { id: string }) {
  const { booking, places, isLoading } = useBooking(id, 'ticket');
  const { toast, dismissToast, open, viewOriginal } = useLinkActions();
  const ticket = booking?.data;
  const venue = ticket ? places.get(ticket.placeId) : undefined;
  const destination = destinationOf(venue);

  return (
    <BookingDetailScreen
      title="Ticket"
      isLoading={isLoading}
      missing={ticket ? null : 'This ticket is no longer in your wallet'}
      toast={toast}
      onDismissToast={dismissToast}
    >
      {ticket ? (
        <>
          <BookingHeader badge={{ icon: 'ticket' }} title={ticket.event} subtitle={venue?.name} />
          <Facts rows={ticketFacts(ticket)} testID="ticket-facts" />
          <BookingLinks
            directions={
              venue
                ? {
                    title: `Directions to ${venue.name}`,
                    subtitle: venue.address,
                    url: destination ? directionsUrl(destination) : null,
                  }
                : null
            }
            originalPath={booking.originalPath}
            originalTitle="View original"
            onOpen={open}
            onViewOriginal={viewOriginal}
          />
        </>
      ) : null}
    </BookingDetailScreen>
  );
}
