import { useLocalSearchParams } from 'expo-router';

import { DocumentFormScreen } from '@/features/documents';

export default function EditDocumentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DocumentFormScreen id={id} />;
}
