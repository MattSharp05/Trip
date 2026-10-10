import { useWrite } from '../shared/query';
import type { BucketItem } from './types';

export const useSaveBucketItem = () => useWrite((s, item: BucketItem) => s.saveBucketItem(item));
export const useDeleteBucketItem = () => useWrite((s, id: string) => s.deleteBucketItem(id));
