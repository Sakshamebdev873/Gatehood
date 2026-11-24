import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Import opened from Towers still has the list under it, so Back lands on Buyers. */
export const unstable_settings = { anchor: 'index' };

/** Buyers list and CSV import share one stack inside the Buyers tab. */
export default function BuyersLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory } }} />;
}
