import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Notices list, new notice and notice stats share one stack inside the Notices tab. */
export default function NoticesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }} />;
}
