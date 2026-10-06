import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, screenPadding, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import { TextLink } from './TextLink';

/** The first screen a signed-out user sees. */
export function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Text variant="largeTitle" accessibilityRole="header">
          Trip
        </Text>
        <Text variant="headline" tone="secondary" style={styles.tagline}>
          Your bookings, plans and the events on your dates, for every trip.
        </Text>
      </View>
      <View style={styles.actions}>
        {/* TR-9: "Continue with Google" goes here, above the email button. */}
        <Button
          label="Continue with email"
          icon="envelope"
          onPress={() => router.push('/auth/sign-up')}
          testID="auth-continue-email"
        />
        <View style={styles.signIn}>
          <Text tone="secondary">Already have an account?</Text>
          <TextLink
            label="Sign in"
            onPress={() => router.push('/auth/sign-in')}
            testID="auth-sign-in"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: screenPadding },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  tagline: { maxWidth: 320 },
  actions: { gap: spacing.lg, paddingBottom: spacing.lg },
  signIn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
});
