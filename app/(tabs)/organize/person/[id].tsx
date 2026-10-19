import { useLocalSearchParams } from 'expo-router';

import { PersonBalanceScreen } from '@/features/budget';

/** A traveller's balance with you and your expenses together (TR-65). */
export default function PersonBalanceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonBalanceScreen id={id} />;
}
