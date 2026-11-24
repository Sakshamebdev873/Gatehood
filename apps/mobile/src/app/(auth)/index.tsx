import { normalizeInviteCode, type ApiErrorCode, type RedeemResponse } from '@gatehood/shared';
import { Link } from 'expo-router';
import { signInWithCustomToken } from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ApiError, NETWORK_MESSAGE, api } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

/** What to tell the buyer for each way a code can be turned down. */
const CODE_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  invalid_code: "We couldn't find that code. Check it against your allotment letter.",
  code_used: 'This code was already used on another phone. Ask the site office for a fresh code.',
  code_expired: 'This code has expired. Ask the site office for a new one.',
};

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return CODE_MESSAGES[err.code] ?? err.message;
  // signInWithCustomToken failing is almost always the connection dropping after redeem.
  return NETWORK_MESSAGE;
}

/** Buyer join screen: redeem an invite code, then sign in with the token it returns. */
export default function Join() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const code = normalizeInviteCode(input);

  async function join() {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<RedeemResponse>('/api/invites/redeem', {
        method: 'POST',
        body: { code },
        auth: false,
      });
      // The auth gate sees the buyer claims and moves to the buyer tabs.
      await signInWithCustomToken(auth, token);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Eyebrow>Buyer access</Eyebrow>
            <Display em="home's updates.">Join your</Display>
            <Body muted>Enter the invite code that came with your allotment letter.</Body>

            <TextInput
              accessibilityLabel="Invite code"
              accessibilityHint="Printed on your allotment letter, for example A1204-7KQ"
              value={input}
              onChangeText={(text) => {
                setInput(text);
                if (error) setError(null);
              }}
              placeholder="A1204-7KQ"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={16}
              returnKeyType="go"
              onSubmitEditing={() => void join()}
              editable={!busy}
              style={[styles.codebox, error ? styles.codeboxError : null]}
            />
            {error ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Button title="Join" onPress={() => void join()} disabled={!code} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Link href="/builder" asChild>
              <Pressable accessibilityRole="link" hitSlop={10}>
                <Text style={styles.footerText}>
                  Builder team? <Text style={styles.footerLink}>Sign in with email</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  form: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 28 },
  codebox: {
    fontFamily: fonts.mono,
    fontSize: 20,
    letterSpacing: 3.6,
    textAlign: 'center',
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  codeboxError: { borderColor: colors.error },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.error, marginTop: -4 },
  footer: { alignItems: 'center', paddingBottom: 22, paddingTop: 10 },
  footerText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  footerLink: { fontFamily: fonts.bodySemibold, color: colors.forest },
});
