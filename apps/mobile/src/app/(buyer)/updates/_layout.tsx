import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Updates feed and notice detail share one stack inside the Updates tab. */
export default function UpdatesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }} />;
}
