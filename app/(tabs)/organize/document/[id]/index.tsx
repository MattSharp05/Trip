import { useLocalSearchParams } from 'expo-router';

import { DocumentDetailScreen } from '@/features/documents';

export default function DocumentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DocumentDetailScreen id={id} />;
}
