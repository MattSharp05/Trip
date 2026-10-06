import { useDataSource, useDeleteDocument, useSaveDocument } from '@/services/data';
import type { DocumentInput, TravelDocument } from '@/services/data/types';

import { isLocalUri, removeDocumentPhotos, uploadDocumentPhoto } from './photos';

/**
 * Saving and deleting a document with its photos. For an account, newly picked photos upload to
 * Storage before the row is saved, and photos the user removed are deleted after it. A demo
 * session keeps local URIs and touches no network.
 */
export function useDocumentWrites() {
  const source = useDataSource();
  const save = useSaveDocument();
  const remove = useDeleteDocument();
  const remote = source.kind === 'supabase';

  return {
    async save(input: DocumentInput, previousPaths: readonly string[] = []) {
      const imagePaths = remote
        ? await Promise.all(
            input.imagePaths.map((p) => (isLocalUri(p) ? uploadDocumentPhoto(p) : p)),
          )
        : input.imagePaths;
      const saved: TravelDocument = await save.mutateAsync({ ...input, imagePaths });
      const dropped = previousPaths.filter((p) => !imagePaths.includes(p));
      // A leftover file is harmless (private, owner-only), so a failed clean-up doesn't fail the save.
      if (remote && dropped.length) void removeDocumentPhotos(dropped).catch(() => {});
      return saved;
    },
    async delete(document: TravelDocument) {
      await remove.mutateAsync(document.id);
      if (remote) void removeDocumentPhotos(document.imagePaths).catch(() => {});
    },
  };
}
