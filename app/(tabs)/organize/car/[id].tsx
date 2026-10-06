import { useLocalSearchParams } from 'expo-router';

import { CarDetail } from '@/features/wallet/car';

export default function CarRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CarDetail id={id} />;
}
