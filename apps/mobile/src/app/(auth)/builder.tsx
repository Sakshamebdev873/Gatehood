import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Eye as EyeIcon, EyeOff } from 'lucide-react-native';
import { useRef, useState, type ComponentRef, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/BackLink';
import { Button } from '@/components/Button';
import { NETWORK_MESSAGE } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

type TextInputRef = ComponentRef<typeof TextInput>;

const WRONG_LOGIN = 'Email or password is wrong.';
const NOT_BUILDER = "This account isn't on the builder team. Buyers join with the invite code instead.";

function messageFor(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === 'auth/network-request-failed') return NETWORK_MESSAGE;
    if (err.code === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes and try again.';
    if (err.code === 'auth/user-disabled') return 'This login has been turned off. Ask your admin.';
  }
  // invalid-credential, wrong-password, user-not-found, invalid-email: say the same thing for all of them.
  return WRONG_LOGIN;
}

/** Builder team sign-in with email and password. */
export default function BuilderSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputRef>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function signIn() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const { claims } = await user.getIdTokenResult();
      if (claims.role !== 'builder') {
        await signOut(auth);
        setError(NOT_BUILDER);
        setBusy(false);
      }
      // A builder is moved to the builder tabs by the auth gate.
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  const clearError = () => {
    if (error) setError(null);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.back}>
            <BackLink label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)'))} />
          </View>

          <View style={styles.form}>
            <Eyebrow>Builder team</Eyebrow>
            <Display em="with email.">Sign in</Display>
            <Body muted>Use the site office login to post notices and see who has read them.</Body>

            <Field
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearError();
              }}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
              invalid={!!error}
            />
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearError();
              }}
              revealable
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void signIn()}
              editable={!busy}
              invalid={!!error}
            />
            {error ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Button title="Sign in" onPress={() => void signIn()} disabled={!canSubmit} loading={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  invalid?: boolean;
  /** A password field with a show / hide button. */
  revealable?: boolean;
  ref?: Ref<TextInputRef>;
};

function Field({ label, invalid, revealable, secureTextEntry, style, ...rest }: FieldProps) {
  const [shown, setShown] = useState(false);
  const Eye = shown ? EyeOff : EyeIcon;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.faint}
          autoCorrect={false}
          spellCheck={false}
          secureTextEntry={revealable ? !shown : secureTextEntry}
          style={[styles.input, revealable && styles.inputWithButton, invalid && styles.inputError, style]}
          {...rest}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown((v) => !v)}
            hitSlop={6}
            style={styles.reveal}
          >
            <Eye size={20} color={colors.muted} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  back: { alignSelf: 'flex-start', paddingTop: 10 },
  form: { flex: 1, justifyContent: 'center', gap: 14, paddingVertical: 28 },
  field: { gap: 6 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.muted },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  inputWithButton: { paddingRight: 52 },
  reveal: { position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  inputError: { borderColor: colors.error },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.error, marginTop: -4 },
});
