import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { useAuth } from '@/auth/AuthProvider';
import { TabIcon, tabScreenOptions } from '@/components/TabIcon';

/** Buyer tabs: Home and Updates. */
export default function BuyerLayout() {
  const { status } = useAuth();
  if (status !== 'buyer') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: 'Updates',
          tabBarIcon: ({ color, focused }) => <TabIcon name="updates" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
