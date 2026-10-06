import type { TicketData } from '@/services/data/types';

import type { FactRow } from '../details';
import { formatDateTime } from '../format';

/** When, then where you sit (only the parts the ticket has), then the confirmation. */
export function ticketFacts(ticket: TicketData): FactRow[] {
  return [
    [{ label: 'Date and time', value: formatDateTime(ticket.starts) }],
    [
      { label: 'Section', value: ticket.section },
      { label: 'Row', value: ticket.row },
      { label: 'Seats', value: ticket.seats },
    ],
    [{ label: 'Confirmation #', value: ticket.confirmation || null }],
  ];
}
