import { useLocalSearchParams } from 'expo-router';

import { WalletItemDetail } from '@/features/wallet';

/** Generic wallet item detail; types with their own screen route elsewhere (cards/registry). */
export default function WalletItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WalletItemDetail id={id} />;
}
