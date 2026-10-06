import { useLocalSearchParams } from 'expo-router';

import { HotelDetail } from '@/features/wallet/hotel';

export default function HotelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HotelDetail id={id} />;
}
