import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now } from '@/core/clock';
import { TextField } from '@/features/auth/TextField';
import { useDocuments } from '@/services/data';
import type { TravelDocument } from '@/services/data/types';
import { colors, continuous, radii, screenPadding, spacing } from '@/theme';
import { Button, Icon, IconButton, Segmented, Skeleton, Text } from '@/ui';

import { DocumentPhoto } from './DocumentPhoto';
import {
  documentName,
  emptyForm,
  formError,
  formFrom,
  MAX_PHOTOS,
  toInput,
  type DocumentForm,
} from './form';
import { pickDocumentPhotos } from './photos';
import { useDocumentWrites } from './useDocumentWrites';

const TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'visa', label: 'Visa' },
] as const;

const THUMB = { width: 96, height: 68 };
const toDay = (date: Date) => format(date, 'yyyy-MM-dd');

function ExpiryRow({ value, onChange }: { value: string | null; onChange: (day: string) => void }) {
  return (
    <View style={styles.row}>
      <Text variant="body">Expires</Text>
      {value ? (
        <DateTimePicker
          value={parseISO(value)}
          mode="date"
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(_event, date) => {
            if (date) onChange(toDay(date));
          }}
          accessibilityLabel="Expires"
          testID="document-form-expiry"
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expiry date"
          hitSlop={8}
          onPress={() => onChange(toDay(now()))}
          testID="document-form-expiry-add"
        >
          <Text variant="body" tone="accent">
            Add date
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Photos({
  paths,
  onAdd,
  onRemove,
}: {
  paths: readonly string[];
  onAdd: () => void;
  onRemove: (path: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.thumbs}
      testID="document-form-photos"
    >
      {paths.map((path, i) => (
        <View key={path}>
          <DocumentPhoto path={path} label={`Photo ${i + 1}`} {...THUMB} />
          <View style={styles.remove}>
            <IconButton
              icon="xmark"
              label={`Remove photo ${i + 1}`}
              size="sm"
              onPress={() => onRemove(path)}
              testID={`document-form-remove-${i}`}
            />
          </View>
        </View>
      ))}
      {paths.length < MAX_PHOTOS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          onPress={onAdd}
          style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}
          testID="document-form-add-photo"
        >
          <Icon name="camera" size="md" tone="secondary" />
          <Text variant="caption" tone="secondary">
            Add photo
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Form({ document }: { document?: TravelDocument }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const writes = useDocumentWrites();
  const [form, setForm] = useState<DocumentForm>(() =>
    document ? formFrom(document) : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<DocumentForm>) => setForm((f) => ({ ...f, ...patch }));

  const addPhotos = async () => {
    const picked = await pickDocumentPhotos();
    if (picked.length) {
      setForm((f) => ({ ...f, imagePaths: [...f.imagePaths, ...picked].slice(0, MAX_PHOTOS) }));
    }
  };

  const save = async () => {
    if (saving) return;
    const missing = formError(form);
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await writes.save(toInput(form, document?.id), document?.imagePaths);
      router.back();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!document) return;
    const name = documentName(document.type).toLowerCase();
    Alert.alert(`Delete this ${name}?`, 'Its photos are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void writes.delete(document).then(
            () => router.dismissTo('/organize'),
            () => setError("Couldn't delete. Check your connection and try again."),
          );
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      testID="document-form"
    >
      <Segmented
        segments={TYPES}
        value={form.type}
        onChange={(type) => update({ type })}
        testID="document-form-type"
      />
      <TextField
        label="Issuing country"
        value={form.country}
        onChangeText={(country) => update({ country })}
        placeholder="United States"
        autoCapitalize="words"
        textContentType="countryName"
        autoComplete="country"
        returnKeyType="next"
        testID="document-form-country"
      />
      <TextField
        label="Number"
        hint="Optional"
        value={form.number}
        onChangeText={(number) => update({ number })}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="document-form-number"
      />
      <View style={styles.card}>
        <ExpiryRow value={form.expiresOn} onChange={(expiresOn) => update({ expiresOn })} />
      </View>
      <View style={styles.section}>
        <Text variant="subhead" tone="secondary">
          Photos
        </Text>
        <Photos
          paths={form.imagePaths}
          onAdd={() => void addPhotos()}
          onRemove={(path) =>
            setForm((f) => ({ ...f, imagePaths: f.imagePaths.filter((p) => p !== path) }))
          }
        />
        <Text variant="caption" tone="secondary">
          Photos stay in your private storage and are never sent to AI.
        </Text>
      </View>
      {error ? (
        <Text variant="subhead" accessibilityRole="alert" testID="document-form-error">
          {error}
        </Text>
      ) : null}
      <Button
        label={saving ? 'Saving…' : 'Save'}
        onPress={() => void save()}
        disabled={saving}
        testID="document-form-save"
      />
      {document ? (
        <Button
          label={`Delete ${documentName(document.type).toLowerCase()}`}
          variant="secondary"
          onPress={confirmDelete}
          testID="document-form-delete"
        />
      ) : null}
    </ScrollView>
  );
}

/**
 * Add or edit a passport or visa (TR-20): type, country, number, expiry and photos from the
 * camera or the photo library. Without `id` it adds a new document.
 */
export function DocumentFormScreen({ id }: { id?: string }) {
  const router = useRouter();
  const documents = useDocuments();
  const document = id ? documents.data?.find((d) => d.id === id) : undefined;
  const title = id ? `Edit ${document ? documentName(document.type) : 'Document'}` : 'Add Document';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
              <Text variant="body">Cancel</Text>
            </Pressable>
          ),
        }}
      />
      {id && documents.isPending ? (
        <View style={[styles.screen, styles.content]}>
          <Skeleton height={36} radius="card" />
          <Skeleton height={66} radius="card" />
          <Skeleton height={66} radius="card" />
        </View>
      ) : id && !document ? (
        <View style={[styles.screen, styles.missing]}>
          <Text variant="headline">This document is no longer in your wallet</Text>
        </View>
      ) : (
        <Form key={document?.id ?? 'new'} document={document} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xl, padding: screenPadding },
  section: { gap: spacing.sm },
  card: {
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  thumbs: { gap: spacing.sm },
  remove: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  addPhoto: {
    ...THUMB,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.card,
    ...continuous,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  missing: { alignItems: 'center', paddingTop: spacing.xxxl },
});
