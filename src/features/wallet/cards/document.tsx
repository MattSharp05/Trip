import { warningText } from '@/features/documents/expiry';
import { documentName } from '@/features/documents/form';
import { useExpiryWarning } from '@/features/documents/useExpiryWarning';

import { formatMonthYear } from '../format';
import type { WalletCardDef, WalletCardRendererProps } from './types';
import { WalletCard } from './WalletCard';

/**
 * A passport or visa (TR-20): country and expiry, or a warning when it expires within six months
 * of an upcoming trip's end (or already has).
 */
function DocumentCard({ entry, onPress }: WalletCardRendererProps<'document'>) {
  const { document } = entry;
  const warning = useExpiryWarning(document.expiresOn);
  const expires = document.expiresOn
    ? `${warning?.kind === 'expired' ? 'Expired' : 'Expires'} ${formatMonthYear(document.expiresOn)}`
    : null;
  const lines = warning ? [expires, warningText(warning)] : [document.country, expires];
  return (
    <WalletCard
      badge={{
        icon: warning
          ? 'exclamationmark.triangle'
          : document.type === 'passport'
            ? 'person.text.rectangle'
            : 'doc.text',
      }}
      title={
        document.country && warning
          ? `${documentName(document.type)} · ${document.country}`
          : documentName(document.type)
      }
      lines={lines.filter((line): line is string => line !== null)}
      onPress={onPress}
      testID={`wallet-card-${entry.id}`}
    />
  );
}

export const documentCard: WalletCardDef<'document'> = {
  label: (entry) => documentName(entry.document.type),
  Card: DocumentCard,
  detailHref: (id) => `/organize/document/${encodeURIComponent(id)}`,
};
