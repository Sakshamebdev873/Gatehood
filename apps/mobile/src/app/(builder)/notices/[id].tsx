import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorRetry, LoadingCards } from '@/components/StateViews';
import { useNoticeStats } from '@/features/builder/hooks';
import { pct, postedLabel } from '@/features/builder/logic';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts } from '@/theme/tokens';

/** Names shown before "+ N more". */
const PREVIEW_NOT_READ = 5;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/notices');
}

/** Who has read a notice: the live count, a bar per tower, and who hasn't read it yet. */
export default function NoticeStatsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const view = useNoticeStats(id);
  const [showAll, setShowAll] = useState(false);

  let content: ReactNode;
  if (view.status === 'loading') {
    content = <LoadingCards count={2} />;
  } else if (view.status === 'missing') {
    content = (
      <View style={styles.missing}>
        <Display size={26}>This notice isn&apos;t available.</Display>
        <Body muted>It may have been removed.</Body>
        <Button title="Back to notices" variant="ghost" onPress={goBack} />
      </View>
    );
  } else if (view.status === 'error') {
    content = (
      <ErrorRetry
        title="Couldn't load read stats"
        body={view.statsError ?? "Can't reach the server. Check your connection and try again."}
        onRetry={view.retry}
      />
    );
  } else {
    const { notice, stats } = view;
    // The live count can be a moment ahead of the fetched stats; show the larger.
    const read = Math.max(notice.readCount, stats.readCount);
    const total = Math.max(stats.joinedInAudience, read);
    const p = pct(read, total);
    const notRead = stats.notRead;
    const shown = showAll ? notRead : notRead.slice(0, PREVIEW_NOT_READ);
    const more = notRead.length - shown.length;

    content = (
      <>
        <View style={styles.titleBlock}>
          <Eyebrow>{postedLabel(notice.target, notice.createdAt)}</Eyebrow>
          <Display size={28}>{notice.title}</Display>
        </View>

        <Card style={styles.gap} accessible accessibilityLabel={`${read} of ${total} joined buyers have read this, ${p} percent`}>
          <View style={styles.row}>
            <Text>
              <Text style={styles.big}>{read}</Text>
              <Text style={styles.small}> / {total} joined buyers read</Text>
            </Text>
            <Text style={styles.monoSmall}>{p}%</Text>
          </View>
          <ProgressBar value={p} height={8} />
          {stats.byTower.length > 0 ? (
            <View style={styles.towers}>
              {stats.byTower.map((t) => (
                <View key={t.towerId} style={styles.tower} accessible accessibilityLabel={`Tower ${t.towerId}: ${t.read} of ${t.joined} read`}>
                  <Text style={styles.towerName}>Tower {t.towerId}</Text>
                  <ProgressBar value={pct(t.read, t.joined)} style={styles.flex} />
                  <Text style={styles.towerCount}>
                    {t.read}/{t.joined}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card style={styles.whoCard}>
          <View style={[styles.row, styles.whoHead]}>
            <Text style={styles.eye}>Not read yet · {notRead.length}</Text>
            <Text style={styles.small}>Joined only</Text>
          </View>
          {notRead.length === 0 ? (
            <Body muted style={styles.allRead}>
              {stats.joinedInAudience === 0 ? 'No buyer in this audience has joined yet.' : 'Everyone who has joined has read it.'}
            </Body>
          ) : null}
          {shown.map((b) => (
            <View key={b.uid} style={styles.who}>
              <Text style={styles.whoName} numberOfLines={1}>
                {b.name || 'Buyer'}
              </Text>
              <Text style={styles.whoUnit}>{b.unitId}</Text>
            </View>
          ))}
          {more > 0 || (showAll && notRead.length > PREVIEW_NOT_READ) ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAll((s) => !s)} style={styles.who} hitSlop={4}>
              <Text style={styles.moreText}>{showAll ? 'Show fewer' : `+ ${more} more`}</Text>
              <Text style={styles.viewAll}>{showAll ? 'LESS' : 'VIEW ALL'}</Text>
            </Pressable>
          ) : null}
        </Card>

        {stats.notJoined > 0 ? (
          <Body muted>
            {stats.notJoined} invited but not joined. They&apos;ll see this once they join.
          </Body>
        ) : null}
        {view.statsError ? <Text style={styles.stale}>Couldn&apos;t refresh just now. Showing the last numbers.</Text> : null}
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.back} hitSlop={8}>
            <ChevronLeft size={18} color={colors.forest} strokeWidth={2} />
            <Text style={styles.backText}>Notices</Text>
          </Pressable>
          <Text style={styles.roleChip}>BUILDER</Text>
        </View>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  content: { padding: 22, gap: 14, paddingBottom: 40 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.forest },
  roleChip: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  titleBlock: { gap: 6 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  big: { fontFamily: fonts.display, fontSize: 44, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  monoSmall: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  towers: { gap: 8, marginTop: 4 },
  tower: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  towerName: { width: 62, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  towerCount: { minWidth: 52, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  whoCard: { paddingVertical: 6 },
  whoHead: { paddingTop: 6, paddingBottom: 4 },
  eye: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.amberDk, textTransform: 'uppercase' },
  allRead: { paddingVertical: 8 },
  who: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  whoName: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: colors.ink },
  whoUnit: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.ink },
  moreText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  viewAll: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, color: colors.forest },
  stale: { fontFamily: fonts.body, fontSize: 12.5, color: colors.faint },
  missing: { gap: 12, paddingVertical: 24 },
});
