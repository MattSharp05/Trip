import { useLocalSearchParams } from 'expo-router';

import { TicketDetail } from '@/features/wallet/ticket';

export default function TicketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketDetail id={id} />;
}
