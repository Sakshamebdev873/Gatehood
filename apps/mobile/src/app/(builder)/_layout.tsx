import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { useAuth } from '@/auth/AuthProvider';
import { TabIcon, tabScreenOptions } from '@/components/TabIcon';

/** Builder tabs: Towers, Notices and Buyers. */
export default function BuilderLayout() {
  const { status } = useAuth();
  if (status !== 'builder') return <Redirect href="/" />;

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
