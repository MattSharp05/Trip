import type { TravelDocument } from '@/services/data/types';

import { formatMonthYear } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

const documentName = (document: TravelDocument) =>
  document.type === 'passport' ? 'Passport' : 'Visa';

function DocumentCard({ entry, onPress }: WalletCardRendererProps<'document'>) {
  const { document } = entry;
  const lines = [
    document.country,
    document.expiresOn ? `Expires ${formatMonthYear(document.expiresOn)}` : null,
  ].filter((line): line is string => line !== null);
  return (
    <WalletCard
      badge={{ icon: document.type === 'passport' ? 'person.text.rectangle' : 'doc.text' }}
      title={documentName(document)}
      lines={lines}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const documentCard: WalletCardDef<'document'> = {
  label: (entry) => documentName(entry.document),
  Card: DocumentCard,
};
