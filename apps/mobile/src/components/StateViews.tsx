import { CircleAlert, Inbox } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Body, Display } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

import { Button } from './Button';
import { Card } from './Card';

/** Skeleton cards shown while a list loads. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.stack} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} style={styles.skelCard}>
          <View style={[styles.skel, { width: '30%' }]} />
          <View style={[styles.skel, { width: '85%', height: 12 }]} />
          <View style={[styles.skel, { width: '60%' }]} />
        </Card>
      ))}
    </View>
  );
}

type EmptyProps = { title: string; em?: string; body?: string };

/** Nothing to show yet. */
export function Empty({ title, em, body }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Inbox size={28} color={colors.faint} strokeWidth={1.6} />
      <Display size={26} em={em} style={styles.centerText}>
        {title}
      </Display>
      {body ? (
        <Body muted style={styles.centerText}>
          {body}
        </Body>
      ) : null}
    </View>
  );
}

type ErrorRetryProps = { title: string; body?: string; onRetry: () => void };

/** Something failed: says what happened and offers a retry. */
export function ErrorRetry({ title, body, onRetry }: ErrorRetryProps) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <CircleAlert size={28} color={colors.error} strokeWidth={1.6} />
      <Display size={26} style={styles.centerText}>
        {title}
      </Display>
      {body ? (
        <Body muted style={styles.centerText}>
          {body}
        </Body>
      ) : null}
      <View style={styles.retry}>
        <Button title="Try again" variant="ghost" onPress={onRetry} />
      </View>
    </View>
  );
}

/** Formats a time like "9:12 am". */
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Shown above the feed when the phone is offline and showing saved updates. */
export function OfflineBanner({ since }: { since: Date }) {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <View style={styles.offlineDot} />
      <Body style={styles.offlineText}>Offline · showing updates from {formatClock(since)}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  skelCard: { gap: 8 },
  skel: { height: 9, borderRadius: 5, backgroundColor: colors.inset },
  center: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 },
  centerText: { textAlign: 'center' },
  retry: { marginTop: 8, minWidth: 160 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inset,
    borderRadius: radius.card / 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint },
  offlineText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
