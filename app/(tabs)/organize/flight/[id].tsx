import { useLocalSearchParams } from 'expo-router';

import { FlightDetail } from '@/features/wallet/flight';

export default function FlightRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FlightDetail id={id} />;
}
