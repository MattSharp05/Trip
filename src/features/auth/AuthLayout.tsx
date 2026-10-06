import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, screenPadding, spacing } from '@/theme';
import { Text } from '@/ui';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the form, e.g. "Already have an account? Sign in". */
  footer?: ReactNode;
}

/** The shared frame of the auth forms: large title, form, footer; the keyboard never covers it. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.content}
        >
          <View style={styles.heading}>
            <Text variant="largeTitle" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
          </View>
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xxxl,
  },
  heading: { gap: spacing.sm },
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
});
