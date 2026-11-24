import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme/tokens';

/** Join and sign-in screens. Anyone already signed in is sent to their tabs. */
export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'buyer') return <Redirect href="/(buyer)" />;
  if (status === 'builder') return <Redirect href="/(builder)" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }} />;
}
