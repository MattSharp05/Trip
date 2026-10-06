import { useLocalSearchParams } from 'expo-router';

import { BoardingPass } from '@/features/wallet/flight';

export default function BoardingPassRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BoardingPass id={id} />;
}
