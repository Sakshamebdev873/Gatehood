import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { LaunchLoading, type LaunchStep } from '@/components/LaunchLoading';
import { TabIcon, tabScreenOptions } from '@/components/TabIcon';
import { ReadStateProvider, useReadState } from '@/features/feed/ReadState';
import { useFeed } from '@/features/feed/useFeed';
import { useMyUnit } from '@/features/unit/useMyUnit';
import { colors } from '@/theme/tokens';

/** Buyer tabs: Home and Updates. */
export default function BuyerLayout() {
  const { status } = useAuth();
  if (status !== 'buyer') return <Redirect href="/" />;

  return (
    <ReadStateProvider>
      <BuyerTabs />
    </ReadStateProvider>
  );
}

/** Pause on the finished steps so the last tick is seen. */
const LAUNCH_DONE_PAUSE_MS = 450;

function BuyerTabs() {
  const { towerId = '', unitId = '' } = useAuth();
  const feed = useFeed('all');
  const unit = useMyUnit();
  const { unreadCount } = useReadState();
  const { launch } = feed;

  // First launch = nothing was saved for "All" when the feed started. The feed decides this once.
  const firstLaunch = launch.cacheChecked ? !launch.hadCache : null;
  const [launchDone, setLaunchDone] = useState(false);

  // Leave the launch screen once saved, or once the feed has failed (its own screen then explains).
  const finished = launch.saved || feed.status === 'error' || feed.status === 'offline';
  useEffect(() => {
    if (!firstLaunch || launchDone || !finished) return;
    const t = setTimeout(() => setLaunchDone(true), LAUNCH_DONE_PAUSE_MS);
    return () => clearTimeout(t);
  }, [firstLaunch, launchDone, finished]);

  // Until the saved feed has been checked (a few ms), show plain ivory rather than flash a screen.
  if (firstLaunch === null) return <View style={{ flex: 1, backgroundColor: colors.ivory }} />;

  if (firstLaunch && !launchDone) {
    const unitReady = unit.status === 'ready';
    const steps: LaunchStep[] = [
      { label: 'Signed in', state: 'done' },
      {
        label: unitReady && unit.unit ? `Tower ${towerId}, ${unit.unit.number} found` : `Finding unit ${unitId}`,
        state: unitReady ? 'done' : 'now',
      },
      { label: 'Loading latest updates', state: launch.serverSeen ? 'done' : 'now' },
      { label: 'Saving them for offline', state: launch.saved ? 'done' : launch.serverSeen ? 'now' : 'todo' },
    ];
    return <LaunchLoading steps={steps} />;
  }

  const unread = unreadCount(feed.items);

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
          tabBarAccessibilityLabel: unread > 0 ? `Updates, ${unread} unread` : 'Updates',
          tabBarIcon: ({ color, focused }) => <TabIcon name="updates" color={color} focused={focused} badge={unread} />,
        }}
      />
    </Tabs>
  );
}
