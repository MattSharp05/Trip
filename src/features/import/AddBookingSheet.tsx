import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { PickedFile } from '@/services/parseBooking';
import { useImportStore } from '@/stores/import';
import { spacing } from '@/theme';
import { ListRow, Sheet, Surface, Text } from '@/ui';

import { pickPdf, pickScreenshot } from './pickFile';

export interface AddBookingSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Organize's `+` (TR-25): import a booking from a PDF or a screenshot, or type in a passport or
 * visa (never read by AI, ADR 0004).
 */
export function AddBookingSheet({ open, onClose }: AddBookingSheetProps) {
  const router = useRouter();
  const start = useImportStore((s) => s.start);

  const pick = async (picker: () => Promise<PickedFile | null>) => {
    onClose();
    const file = await picker().catch(() => null);
    if (!file) return;
    start(file);
    router.push('/organize/import');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add to your wallet" testID="add-booking-sheet">
      <Surface padding="none">
        <ListRow
          icon="doc"
          title="Choose a PDF"
          subtitle="A booking confirmation"
          onPress={() => void pick(pickPdf)}
          separator
          testID="add-booking-pdf"
        />
        <ListRow
          icon="photo"
          title="Choose a screenshot"
          subtitle="From an airline, hotel or ticket app"
          onPress={() => void pick(pickScreenshot)}
          separator
          testID="add-booking-screenshot"
        />
        <ListRow
          icon="person.text.rectangle"
          title="Add a passport or visa"
          subtitle="Typed in by you, never read by AI"
          onPress={() => {
            onClose();
            router.push('/organize/document/new');
          }}
          testID="add-booking-document"
        />
      </Surface>
      <View style={styles.note}>
        <Text variant="caption" tone="secondary">
          Bookings are read by Google Gemini&apos;s free tier.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: spacing.xs },
});
