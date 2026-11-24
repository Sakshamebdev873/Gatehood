import { daysUntil } from '@gatehood/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NoticeRow } from '@/components/NoticeRow';
import { ErrorRetry, LoadingCards, OfflineBanner } from '@/components/StateViews';
import { audienceLabel, relativeTime } from '@/features/feed/labels';
import { useReadState } from '@/features/feed/ReadState';
import { useFeed } from '@/features/feed/useFeed';
import { useMyUnit } from '@/features/unit/useMyUnit';
import { useNow } from '@/lib/useNow';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

const PROJECT_NAME = process.env.EXPO_PUBLIC_PROJECT_NAME || 'Aravali Heights';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1640 → "1,640". */
function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** My Unit: the buyer's home, construction progress, possession, and the newest pinned notice. */
export default function MyUnit() {
  const { towerId = '', unitId = '', signOut } = useAuth();
  const { status, unit, tower, retry } = useMyUnit();
  const feed = useFeed('all');
  const { isRead } = useReadState();
  const pinned = feed.items.find((n) => n.pinned);
  const now = useNow();

  const layout = [unit?.config, unit?.areaSqft ? `${groupThousands(unit.areaSqft)} sq ft` : null]
    .filter(Boolean)
    .join(' · ');
  const possession = tower?.possessionDate ?? null;
  const days = possession ? daysUntil(possession, new Date(now)) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Text style={styles.project}>{PROJECT_NAME}</Text>
          <Text style={styles.chip}>{unitId}</Text>
        </View>

        {feed.status === 'offline' && feed.offlineSince ? <OfflineBanner since={feed.offlineSince} /> : null}

        {status === 'loading' ? <LoadingCards count={3} /> : null}
        {status === 'error' ? (
          <ErrorRetry
            title="Couldn't load your unit"
            body="Check your connection, then try again."
            onRetry={retry}
          />
        ) : null}

        {status === 'ready' && unit && tower ? (
          <>
            <View style={styles.heading}>
              <Eyebrow>My unit</Eyebrow>
              <Display em={layout || undefined}>{`Tower ${towerId}, ${unit.number}`}</Display>
            </View>

            <Card style={styles.gap8}>
              <View style={styles.row}>
                <Eyebrow style={styles.mutedEyebrow}>Construction</Eyebrow>
                <Text style={styles.big}>{tower.progressPct}%</Text>
              </View>
              <View
                style={styles.bar}
                accessibilityRole="progressbar"
                accessibilityLabel={`Construction ${tower.progressPct}% complete`}
                accessibilityValue={{ min: 0, max: 100, now: tower.progressPct }}
              >
                <View style={[styles.barFill, { width: `${tower.progressPct}%` }]} />
              </View>
              <Body muted style={styles.small}>
                {tower.name} · {tower.progressPct}% complete
              </Body>
            </Card>

            <View style={styles.grid}>
              <Card style={styles.cell}>
                <Text style={styles.big}>{days ?? '—'}</Text>
                <Body muted style={styles.small}>
                  {days === null ? 'Not announced yet' : days === 1 ? 'day to possession' : 'days to possession'}
                </Body>
              </Card>
              <Card style={styles.cell}>
                <Text style={[styles.big, styles.month]}>
                  {possession ? `${MONTHS[possession.getUTCMonth()]} ${possession.getUTCFullYear()}` : '—'}
                </Text>
                <Body muted style={styles.small}>
                  {possession ? 'handover target' : 'Not announced yet'}
                </Body>
              </Card>
            </View>
          </>
        ) : null}

        {pinned ? (
          <NoticeRow
            notice={pinned}
            label={audienceLabel(pinned, { towerId, unitId })}
            when={relativeTime(pinned.createdAt, now)}
            read={isRead(pinned.id)}
          />
        ) : null}

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
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  project: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.ink },
  chip: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  heading: { gap: 6, marginTop: 4 },
  gap8: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  mutedEyebrow: { color: colors.muted },
  big: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.ink },
  month: { fontSize: 26, lineHeight: 38 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.inset, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.forest },
  small: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, gap: 2 },
  signOut: { marginTop: 18 },
});
