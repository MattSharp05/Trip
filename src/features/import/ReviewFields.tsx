import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/features/auth/TextField';
import { colors, continuous, radii, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import type { FieldDef, Values } from './draft';

const CHECK = "Check this one: it wasn't clear on the booking.";

export interface ReviewFieldsProps {
  fields: readonly FieldDef[];
  values: Values;
  uncertain: readonly string[];
  errors: Record<string, string>;
  onChange: (path: string, value: string) => void;
}

const testIdOf = (path: string) => `review-${path.replace(/\./g, '-')}`;

/** Every field of the booking, editable; doubtful ones carry a note, wrong ones an error. */
export function ReviewFields({ fields, values, uncertain, errors, onChange }: ReviewFieldsProps) {
  return (
    <View style={styles.fields}>
      {fields.map((field) => {
        const value = values[field.path] ?? '';
        const error = errors[field.path] ?? null;
        const doubt = uncertain.includes(field.path) ? CHECK : undefined;
        return (
          <Fragment key={field.path}>
            {field.section ? (
              <Text variant="headline" accessibilityRole="header" style={styles.section}>
                {field.section}
              </Text>
            ) : null}
            {field.kind === 'date' || field.kind === 'time' ? (
              <WhenField
                field={field}
                value={value}
                error={error}
                doubt={doubt}
                onChange={onChange}
              />
            ) : (
              <TextField
                label={field.label}
                value={value}
                onChangeText={(text) => onChange(field.path, text)}
                error={error}
                hint={doubt}
                autoCapitalize={
                  field.kind === 'code' || field.kind === 'currency' ? 'characters' : 'sentences'
                }
                autoCorrect={false}
                keyboardType={
                  field.kind === 'amount'
                    ? 'decimal-pad'
                    : field.kind === 'count'
                      ? 'number-pad'
                      : 'default'
                }
                maxLength={field.kind === 'code' || field.kind === 'currency' ? 3 : undefined}
                returnKeyType="done"
                testID={testIdOf(field.path)}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

/** A date or time on the native compact picker. */
function WhenField({
  field,
  value,
  error,
  doubt,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error: string | null;
  doubt?: string;
  onChange: (path: string, value: string) => void;
}) {
  const isDate = field.kind === 'date';
  const current = isDate
    ? value
      ? parseISO(value)
      : new Date()
    : parseISO(`2000-01-01T${value || '12:00'}`);
  const note = error ?? doubt;
  return (
    <View style={styles.when}>
      <View style={[styles.whenRow, error ? styles.whenError : null]}>
        <Text variant="body">{field.label}</Text>
        <DateTimePicker
          value={current}
          mode={isDate ? 'date' : 'time'}
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(_event, picked) => {
            if (picked) onChange(field.path, format(picked, isDate ? 'yyyy-MM-dd' : 'HH:mm'));
          }}
          accessibilityLabel={field.label}
          testID={testIdOf(field.path)}
        />
      </View>
      {note ? (
        <View style={styles.note}>
          <Icon name="exclamationmark.circle" size="sm" tone="secondary" />
          <Text variant="subhead" tone="secondary" style={styles.noteText}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.md },
  section: { marginTop: spacing.sm },
  when: { gap: spacing.xs },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    ...continuous,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  // No red (design.md): an error gets a brighter border.
  whenError: { borderColor: colors.textSecondary, borderWidth: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteText: { flex: 1 },
});
