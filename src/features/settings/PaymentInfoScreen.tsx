import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Profile, useSaveMyProfile } from '@/services/data';
import { Button, Toast } from '@/ui';

import { WithMyProfile } from './WithMyProfile';
import {
  parsePaymentFields,
  paymentFieldsOf,
  withPayment,
  type PaymentErrors,
  type PaymentFields,
} from './profileForm';
import { SAVE_FAILED } from './usePreferences';
import { FieldRow, SettingsGroup, SettingsScroll } from './SettingsList';

/** Settings → Payment info: optional Venmo, Cash App and Zelle details for settling up. */
export function PaymentInfoScreen() {
  return (
    <WithMyProfile rows={3} testID="payment-info">
      {(profile) => <PaymentForm key={profile.id} profile={profile} />}
    </WithMyProfile>
  );
}

function PaymentForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const save = useSaveMyProfile();
  const [fields, setFields] = useState<PaymentFields>(() => paymentFieldsOf(profile));
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const hideMessage = useCallback(() => setMessage(null), []);

  const change = (key: keyof PaymentFields) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async () => {
    if (save.isPending) return;
    const parsed = parsePaymentFields(fields);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(withPayment(profile, parsed.values));
      router.back();
    } catch {
      setMessage(SAVE_FAILED);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsScroll testID="payment-info">
        <SettingsGroup footer="Friends on your trips see these when they settle up.">
          <FieldRow
            label="Venmo"
            value={fields.venmo}
            onChangeText={change('venmo')}
            error={errors.venmo}
            placeholder="Username"
            autoCapitalize="none"
            separator
            testID="payment-venmo"
          />
          <FieldRow
            label="Cash App"
            value={fields.cashapp}
            onChangeText={change('cashapp')}
            error={errors.cashapp}
            placeholder="$cashtag"
            autoCapitalize="none"
            separator
            testID="payment-cashapp"
          />
          <FieldRow
            label="Zelle"
            value={fields.zelle}
            onChangeText={change('zelle')}
            error={errors.zelle}
            placeholder="Email or phone"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="payment-zelle"
          />
        </SettingsGroup>
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={save.isPending}
          onPress={() => void submit()}
          testID="payment-save"
        />
      </SettingsScroll>
      <Toast
        visible={message !== null}
        message={message ?? ''}
        onDismiss={hideMessage}
        placement="screen"
      />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
