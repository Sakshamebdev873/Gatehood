import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { useAuth } from '@/auth/AuthProvider';
import { TabIcon, tabScreenOptions } from '@/components/TabIcon';

/** Builder tabs: Towers, Notices and Buyers. */
export default function BuilderLayout() {
  const { status } = useAuth();
  // Name the group: a bare "/" resolves back into this group and redirects forever.
  if (status === 'buyer') return <Redirect href="/(buyer)" />;
  if (status !== 'builder') return <Redirect href="/(auth)" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Towers',
          tabBarIcon: ({ color, focused }) => <TabIcon name="towers" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: 'Notices',
          tabBarIcon: ({ color, focused }) => <TabIcon name="notices" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="buyers"
        options={{
          title: 'Buyers',
          tabBarIcon: ({ color, focused }) => <TabIcon name="buyers" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
