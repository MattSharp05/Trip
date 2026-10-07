import { format, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDocuments } from '@/services/data';
import type { TravelDocument } from '@/services/data/types';
import { colors, screenPadding, spacing } from '@/theme';
import { Button, Icon, ListRow, LoadError, Skeleton, Surface, Text } from '@/ui';

import { DocumentPhoto } from './DocumentPhoto';
import { warningText } from './expiry';
import { documentName } from './form';
import { PhotoViewer } from './PhotoViewer';
import { useExpiryWarning } from './useExpiryWarning';

const PHOTO_HEIGHT = 230;

function Facts({ document }: { document: TravelDocument }) {
  const rows = [
    { title: 'Country', value: document.country },
    { title: 'Number', value: document.number },
    {
      title: 'Expires',
      value: document.expiresOn ? format(parseISO(document.expiresOn), 'MMM d, yyyy') : null,
    },
  ].filter((row): row is { title: string; value: string } => Boolean(row.value));
  return (
    <Surface padding="none">
      {rows.map((row, i) => (
        <ListRow
          key={row.title}
          title={row.title}
          value={row.value}
          separator={i < rows.length - 1}
          testID={`document-fact-${row.title.toLowerCase()}`}
        />
      ))}
    </Surface>
  );
}

function Detail({ document }: { document: TravelDocument }) {
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
  const warning = useExpiryWarning(document.expiresOn);
  const name = documentName(document.type);
  const edit = () => router.push(`/organize/document/${encodeURIComponent(document.id)}/edit`);

  return (
    <>
      {warning ? (
        <Surface padding="md" style={styles.warning} testID="document-warning">
          <Icon name="exclamationmark.triangle" size="md" />
          <Text variant="subhead" style={styles.warningText}>
            {warningText(warning)}
          </Text>
        </Surface>
      ) : null}

      {document.imagePaths.length > 0 ? (
        <ScrollView
          horizontal={document.imagePaths.length > 1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
          scrollEnabled={document.imagePaths.length > 1}
        >
          {document.imagePaths.map((path, i) => (
            <Pressable
              key={path}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${name} photo ${i + 1}, opens full screen`}
              onPress={() => setViewing(i)}
              style={document.imagePaths.length > 1 ? styles.photoNarrow : styles.photoWide}
              testID={`document-photo-${i}`}
            >
              <DocumentPhoto path={path} label={`${name} photo ${i + 1}`} height={PHOTO_HEIGHT} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Surface style={styles.noPhoto} testID="document-no-photo">
          <Icon name="photo" size="lg" tone="secondary" />
          <Text variant="subhead" tone="secondary">
            No photo yet
          </Text>
          <Button label="Add a photo" variant="secondary" icon="camera" onPress={edit} />
        </Surface>
      )}

      <Facts document={document} />

      <Text variant="caption" tone="secondary" style={styles.privacy}>
        Saved to your account only and never sent to AI.
      </Text>

      <PhotoViewer
        paths={document.imagePaths}
        index={viewing}
        title={name}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

/** Organize → a passport or visa (TR-20): its photos (tap for full screen), details and expiry. */
export function DocumentDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const documents = useDocuments();
  const document = documents.data?.find((d) => d.id === id);
  const title = document ? documentName(document.type) : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackTitle: 'Organize',
          headerRight: document
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    router.push(`/organize/document/${encodeURIComponent(document.id)}/edit`)
                  }
                  testID="document-edit"
                >
                  <Text variant="body">Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      {documents.isPending ? (
        <>
          <Skeleton height={PHOTO_HEIGHT} radius="card" />
          <Skeleton height={132} radius="card" />
        </>
      ) : document ? (
        <Detail document={document} />
      ) : documents.isError ? (
        <LoadError
          message="Couldn't load this document. Check your connection."
          onRetry={() => void documents.refetch()}
        />
      ) : (
        <View style={styles.missing}>
          <Text variant="headline">This document is no longer in your wallet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: screenPadding, paddingBottom: spacing.xxxl },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  warningText: { flex: 1 },
  photos: { gap: spacing.sm },
  photoWide: { width: '100%' },
  photoNarrow: { width: 300 },
  noPhoto: { alignItems: 'center', gap: spacing.md },
  privacy: { textAlign: 'center' },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
