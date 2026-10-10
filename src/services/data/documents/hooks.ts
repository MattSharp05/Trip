import { useQuery } from '@tanstack/react-query';

import { useDataSource } from '../active';
import { dataKeys, queryClient, useWrite } from '../shared/query';
import type { DocumentInput } from './types';

export function useDocuments() {
  const source = useDataSource();
  return useQuery(
    { queryKey: dataKeys.documents(source), queryFn: () => source.listDocuments() },
    queryClient,
  );
}

export const useSaveDocument = () =>
  useWrite((s, document: DocumentInput) => s.saveDocument(document));
export const useDeleteDocument = () => useWrite((s, id: string) => s.deleteDocument(id));
