import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';

/** Entry route: sends each user to their own group. */
export default function Index() {
  const { status } = useAuth();
  if (status === 'buyer') return <Redirect href="/(buyer)" />;
  if (status === 'builder') return <Redirect href="/(builder)" />;
  return <Redirect href="/(auth)" />;
}
