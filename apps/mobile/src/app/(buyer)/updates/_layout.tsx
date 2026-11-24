import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** A notice opened from Home still has the list under it, so Back lands on Updates. */
export const unstable_settings = { anchor: 'index' };

/** Updates feed and notice detail share one stack inside the Updates tab. */
export default function UpdatesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }} />;
}
