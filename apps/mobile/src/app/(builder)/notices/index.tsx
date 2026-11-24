import type { BuyersResponse, Notice } from '@gatehood/shared';
import { router } from 'expo-router';
import { Pin, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Empty, ErrorRetry, LoadingCards } from '@/components/StateViews';
import { useApiData, useBuilderNotices } from '@/features/builder/hooks';
import { joinedInAudience, targetLabel } from '@/features/builder/logic';
import { relativeTime } from '@/features/feed/labels';
import { api, ApiError, NETWORK_MESSAGE } from '@/lib/api';
import { useNow } from '@/lib/useNow';
import { Display } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

/** Every notice posted, newest first, with live read counts and a pin switch. */
export default function Notices() {
  const list = useBuilderNotices();
  // Who has joined, to show "3 of 7 read". The list still works without it ("3 read").
  const buyers = useApiData<BuyersResponse>('/api/builder/buyers').data?.buyers;
  const now = useNow();
  // Pin changes show at once. Each remembers the live value it was made from, and stops
  // applying as soon as the live list moves off that value (it has caught up, or changed elsewhere).
  const [pinning, setPinning] = useState<Record<string, { value: boolean; from: boolean }>>({});
  const [inFlight, setInFlight] = useState<Record<string, true>>({});
  const without = <T,>(rec: Record<string, T>, id: string) => {
    const next = { ...rec };
    delete next[id];
    return next;
  };
  const shownPinned = (n: Notice) => {
    const o = pinning[n.id];
    return o && o.from === n.pinned ? o.value : n.pinned;
  };

  const setPinned = async (notice: Notice, pinned: boolean) => {
    setPinning((p) => ({ ...p, [notice.id]: { value: pinned, from: notice.pinned } }));
    setInFlight((f) => ({ ...f, [notice.id]: true }));
    try {
      await api(`/api/builder/notices/${encodeURIComponent(notice.id)}`, { method: 'PATCH', body: { pinned } });
    } catch (err) {
      setPinning((p) => without(p, notice.id));
      Alert.alert(
        pinned ? "Couldn't pin this notice" : "Couldn't unpin this notice",
        err instanceof ApiError ? err.message : NETWORK_MESSAGE,
      );
    } finally {
      setInFlight((f) => without(f, notice.id));
    }
  };

  let body: ReactNode;
  if (list.status === 'loading') {
    body = (
      <View style={styles.pad}>
        <LoadingCards count={4} />
      </View>
    );
  } else if (list.status === 'error') {
    body = (
      <ErrorRetry
        title="Couldn't load notices"
        body="Can't reach the server. Check your connection and try again."
        onRetry={list.retry}
      />
    );
  } else if (list.status === 'empty') {
    body = <Empty title="No notices" em="yet." body="Tap New notice to post the first one." />;
  } else {
    body = (
      <FlatList
        data={list.items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <BuilderNoticeRow
            notice={item}
            when={relativeTime(item.createdAt, now)}
            joined={buyers ? joinedInAudience(item.target, buyers) : undefined}
            pinned={shownPinned(item)}
            busy={item.id in inFlight}
            onPin={(v) => void setPinned(item, v)}
          />
        )}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          list.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.faint} />
              <Text style={styles.footerText}>{list.items.length} · loading more</Text>
            </View>
          ) : (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {list.hasMore ? `${list.items.length} · scroll for more` : `${list.items.length} · that's everything`}
              </Text>
            </View>
          )
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Display size={30}>Notices</Display>
      </View>
      <View style={styles.flex}>{body}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New notice"
        onPress={() => router.push('/notices/new')}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Plus size={18} color={colors.white} strokeWidth={2.2} />
        <Text style={styles.fabText}>New notice</Text>
      </Pressable>
    </SafeAreaView>
  );
}

type RowProps = {
  notice: Notice;
  when: string;
  /** Joined buyers it reaches, once known. */
  joined?: number;
  pinned: boolean;
  busy: boolean;
  onPin: (pinned: boolean) => void;
};

function BuilderNoticeRow({ notice, when, joined, pinned, busy, onPin }: RowProps) {
  const audience = targetLabel(notice.target);
  // The live count can be a moment ahead of the joined list; never show "5 of 4".
  const of = joined === undefined ? undefined : Math.max(joined, notice.readCount);
  const reads = of === undefined ? `${notice.readCount} read` : `${notice.readCount} of ${of} read`;
  return (
    <View style={[styles.row, pinned && styles.pinnedRow]}>
      {pinned ? <View style={styles.pinEdge} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${audience}. ${notice.title}. ${reads}. Open read stats`}
        onPress={() => router.push({ pathname: '/notices/[id]', params: { id: notice.id } })}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <Text style={styles.label} numberOfLines={1}>
            {(pinned ? `Pinned · ${audience}` : audience).toUpperCase()}
          </Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {notice.title}
        </Text>
        <Text style={styles.reads}>
          <Text style={styles.readsNum}>{notice.readCount}</Text>
          {of === undefined ? ' read' : ` of ${of} read`}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Pin to the top of buyer feeds"
        accessibilityState={{ checked: pinned, disabled: busy }}
        disabled={busy}
        onPress={() => onPin(!pinned)}
        hitSlop={8}
        style={({ pressed }) => [styles.pin, pinned && styles.pinOn, (pressed || busy) && styles.pressed]}
      >
        <Pin size={13} color={pinned ? colors.white : colors.forest} strokeWidth={2.2} fill={pinned ? colors.white : 'none'} />
        <Text style={[styles.pinText, pinned && styles.pinTextOn]}>{pinned ? 'Pinned' : 'Pin'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
  pad: { paddingHorizontal: 22, paddingTop: 8 },
  list: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 96, gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16 },
  footerText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, color: colors.faint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pinnedRow: { borderColor: colors.forest },
  pinEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.forest },
  rowMain: { flex: 1, paddingVertical: 12, paddingLeft: 17, paddingRight: 6, gap: 4 },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.amberDk },
  when: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.ink },
  reads: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  readsNum: { fontFamily: fonts.monoMedium, color: colors.forest },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 12,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  pinOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  pinText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: colors.forest },
  pinTextOn: { color: colors.white },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.white },
});
