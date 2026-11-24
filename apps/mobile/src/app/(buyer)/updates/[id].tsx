import type { Notice } from '@gatehood/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { BackLink } from '@/components/BackLink';
import { Button } from '@/components/Button';
import { ErrorRetry, LoadingCards } from '@/components/StateViews';
import { findSavedNotice } from '@/features/feed/cache';
import { audienceLabel, fullDate } from '@/features/feed/labels';
import { isGoneError } from '@/features/feed/noticeLoad';
import { toNotice } from '@/features/feed/queries';
import { useReadState } from '@/features/feed/ReadState';
import { findLoadedNotice } from '@/features/feed/useFeed';
import { db } from '@/lib/firebase';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; notice: Notice }
  /** Deleted, never existed, or not meant for this buyer. */
  | { status: 'missing' }
  /** Not in the saved feed and the server can't be reached. */
  | { status: 'offline' };

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/updates');
}

/** One notice in full. Opening it is what counts as reading it. */
export default function NoticeDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { uid, towerId = '', unitId = '' } = useAuth();
  const { markRead } = useReadState();
  const [fetched, setLoad] = useState<Load>({ status: 'loading' });
  const load: Load = uid && id ? fetched : { status: 'missing' };
  const [attempt, setAttempt] = useState(0);
  const marked = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !id) return;
    let active = true;

    (async () => {
      // The feed's copy first, so the screen opens at once and works offline.
      let cached: Notice | null = findLoadedNotice(uid, id) ?? null;
      if (!cached) cached = await findSavedNotice(uid, id);
      if (!active) return;
      if (cached) setLoad({ status: 'ready', notice: cached });

      // Then the current copy, in case it was edited, retargeted or removed since.
      try {
        const snap = await getDoc(doc(db, 'notices', id));
        if (!active) return;
        setLoad(snap.exists() ? { status: 'ready', notice: toNotice(snap.id, snap.data()) } : { status: 'missing' });
      } catch (err) {
        if (!active) return;
        if (isGoneError(err)) setLoad({ status: 'missing' });
        else if (!cached) setLoad({ status: 'offline' });
        // Offline with a saved copy: keep showing it.
      }
    })();

    return () => {
      active = false;
    };
  }, [uid, id, attempt]);

  // Mark read once per notice, as soon as it is on screen. Offline, this shows as read at once
  // and is sent when the phone is back online; the server counts each buyer once.
  const shownId = load.status === 'ready' ? load.notice.id : null;
  useEffect(() => {
    if (!shownId || marked.current === shownId) return;
    marked.current = shownId;
    markRead(shownId);
  }, [shownId, markRead]);

  const retry = () => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.bar}>
        <BackLink label="Updates" onPress={goBack} />
      </View>

      {load.status === 'loading' ? (
        <View style={styles.pad}>
          <LoadingCards count={1} />
        </View>
      ) : null}

      {load.status === 'missing' ? (
        <View style={styles.center} accessibilityRole="alert">
          <Display size={26} style={styles.centerText}>
            This update isn&apos;t available.
          </Display>
          <Body muted style={styles.centerText}>
            It may have been removed, or it isn&apos;t meant for your unit.
          </Body>
          <View style={styles.centerButton}>
            <Button title="Back" variant="ghost" onPress={goBack} />
          </View>
        </View>
      ) : null}

      {load.status === 'offline' ? (
        <ErrorRetry
          title="Couldn't open this update"
          body="You're offline and it isn't saved on this phone. Connect, then try again."
          onRetry={retry}
        />
      ) : null}

      {load.status === 'ready' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.meta}>
            <Eyebrow style={styles.flexShrink} numberOfLines={1}>
              {audienceLabel({ ...load.notice, pinned: false }, { towerId, unitId })}
            </Eyebrow>
            {load.notice.pinned ? <Text style={styles.pinTag}>PINNED</Text> : null}
          </View>
          <Display size={32}>{load.notice.title}</Display>
          <Text style={styles.date}>{fullDate(load.notice.createdAt)}</Text>
          <View style={styles.rule} />
          <Text style={styles.body} selectable>
            {load.notice.body}
          </Text>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  bar: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 },
  pad: { paddingHorizontal: 22, paddingTop: 12 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 40, gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flexShrink: { flexShrink: 1 },
  pinTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.white,
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  date: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6, color: colors.faint },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.ink },
  center: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 },
  centerText: { textAlign: 'center' },
  centerButton: { marginTop: 8, minWidth: 160 },
});
