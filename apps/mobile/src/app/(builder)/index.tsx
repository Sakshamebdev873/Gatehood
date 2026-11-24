import type { OverviewResponse } from '@gatehood/shared';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Empty, ErrorRetry, LoadingCards } from '@/components/StateViews';
import { useApiData } from '@/features/builder/hooks';
import { pct } from '@/features/builder/logic';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts } from '@/theme/tokens';

/** Joined by tower: one card per tower with joined / invited and the unit count. */
export default function Towers() {
  const { signOut } = useAuth();
  const overview = useApiData<OverviewResponse>('/api/builder/overview');
  const towers = overview.data?.towers ?? [];
  const invited = towers.reduce((n, t) => n + t.invited, 0);
  const joined = towers.reduce((n, t) => n + t.joined, 0);

  let body: ReactNode;
  if (overview.status === 'loading') {
    body = <LoadingCards count={3} />;
  } else if (overview.status === 'error') {
    body = <ErrorRetry title="Couldn't load towers" body={overview.error} onRetry={overview.reload} />;
  } else if (invited === 0) {
    body = (
      <View>
        <Empty title="No buyers" em="yet." body="Import a CSV to send invite codes." />
        <Button title="Import CSV" onPress={() => router.push('/buyers/import')} />
      </View>
    );
  } else {
    body = (
      <>
        <Body muted>
          {joined} of {invited} invited buyers have joined.
        </Body>
        {towers.map((t) => {
          const p = pct(t.joined, t.invited);
          return (
            <Pressable
              key={t.towerId}
              accessibilityRole="button"
              accessibilityLabel={`${t.name}: ${t.joined} of ${t.invited} invited buyers joined, ${t.units} units`}
              accessibilityHint="Shows this tower's buyers and their codes"
              onPress={() => router.navigate({ pathname: '/buyers', params: { tower: t.towerId } })}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Display size={24}>{t.name}</Display>
                  <View style={styles.pctWrap}>
                    <Text style={styles.pct}>{p}%</Text>
                    <ChevronRight size={18} color={colors.faint} strokeWidth={1.8} />
                  </View>
                </View>
                <ProgressBar value={p} />
                <View style={styles.row}>
                  <Text style={styles.stat}>
                    <Text style={styles.strong}>{t.joined}</Text> / {t.invited} joined
                  </Text>
                  <Text style={styles.stat}>{t.units} units</Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={overview.refreshing} onRefresh={overview.refresh} tintColor={colors.forest} colors={[colors.forest]} />
        }
      >
        <Eyebrow>Builder · towers</Eyebrow>
        <Display em="has joined.">Who</Display>
        {body}
        <View style={styles.signOut}>
          <Button title="Sign out of this phone" variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 22, gap: 14 },
  card: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pctWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pct: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  pressed: { opacity: 0.75 },
  stat: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  strong: { fontFamily: fonts.bodySemibold, color: colors.ink },
  signOut: { marginTop: 18 },
});
