import type { Notice } from '@gatehood/shared';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { NoticeRow } from '@/components/NoticeRow';
import { Segmented } from '@/components/Segmented';
import { Empty, ErrorRetry, LoadingCards, OfflineBanner } from '@/components/StateViews';
import { audienceLabel, relativeTime } from '@/features/feed/labels';
import { useReadState } from '@/features/feed/ReadState';
import { useFeed, type FeedFilter } from '@/features/feed/useFeed';
import { useNow } from '@/lib/useNow';
import { Display } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'tower', label: 'My tower' },
  { value: 'unit', label: 'My unit' },
] as const satisfies readonly { value: FeedFilter; label: string }[];

const EMPTY_WHO: Record<FeedFilter, string> = {
  all: 'the project yet.',
  tower: 'your tower yet.',
  unit: 'your unit yet.',
};

/** The buyer's live feed: All / My tower / My unit, 15 at a time, with read state and offline copy. */
export default function Updates() {
  const { towerId = '', unitId = '' } = useAuth();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const feed = useFeed(filter);
  const { isRead, unreadCount } = useReadState();
  const list = useRef<FlatList<Notice>>(null);
  const unread = unreadCount(feed.items);
  const now = useNow();
  const me = { towerId, unitId };

  const showNew = () => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    feed.ackNew();
  };

  const footer = () => {
    if (feed.items.length === 0) return null;
    const of = feed.total !== undefined ? `${feed.items.length} of ${Math.max(feed.total, feed.items.length)}` : `${feed.items.length}`;
    if (feed.loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.faint} />
          <Text style={styles.footerText}>{of} · loading more</Text>
        </View>
      );
    }
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>{feed.hasMore ? `${of} · scroll for more` : `${of} · that's everything`}</Text>
      </View>
    );
  };

  let body: ReactNode;
  if (feed.status === 'loading') {
    body = (
      <View style={styles.pad}>
        <LoadingCards count={4} />
      </View>
    );
  } else if (feed.status === 'error') {
    body = (
      <ErrorRetry
        title="Couldn't load updates"
        body="Can't reach the server. Check your connection and try again."
        onRetry={feed.retry}
      />
    );
  } else if (feed.status === 'empty' || feed.items.length === 0) {
    body = <Empty title="No updates for" em={EMPTY_WHO[filter]} body="New notices from the site office show up here." />;
  } else {
    body = (
      <FlatList
        ref={list}
        data={feed.items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <NoticeRow
            notice={item}
            label={audienceLabel(item, me)}
            when={relativeTime(item.createdAt, now)}
            read={isRead(item.id)}
          />
        )}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={footer}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topbar}>
          <Display size={30}>Updates</Display>
          {unread > 0 ? <Text style={styles.chip}>{unread} unread</Text> : null}
        </View>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        {feed.status === 'offline' && feed.offlineSince ? <OfflineBanner since={feed.offlineSince} /> : null}
        {feed.newCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={showNew} style={styles.newPill} hitSlop={8}>
            <Text style={styles.newPillText}>
              ↑ {feed.newCount} new {feed.newCount === 1 ? 'update' : 'updates'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.flex}>{body}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6, gap: 12 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  newPill: {
    alignSelf: 'center',
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  newPillText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.white },
  pad: { paddingHorizontal: 22, paddingTop: 8 },
  list: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28, gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16 },
  footerText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, color: colors.faint },
});
