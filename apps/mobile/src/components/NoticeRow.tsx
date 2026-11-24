import type { Notice } from '@gatehood/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

type NoticeRowProps = {
  notice: Notice;
  /** Eyebrow: "Pinned · all towers", "Tower A", "Your unit · A-1204". */
  label: string;
  /** Short age: "2h", "3d". */
  when: string;
  read: boolean;
  onPress?: () => void;
};

/** One feed row: bold with an orange dot when unread, muted when read, forest edge when pinned. */
export function NoticeRow({ notice, label, when, read, onPress }: NoticeRowProps) {
  const a11y = `${read ? '' : 'Unread. '}${label}. ${notice.title}. ${when === 'now' ? 'Just now' : `${when} ago`}`;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        read && styles.read,
        notice.pinned && styles.pinned,
        pressed && styles.pressed,
      ]}
    >
      {notice.pinned ? <View style={styles.pinEdge} /> : null}
      <View style={styles.top}>
        <Text style={[styles.label, read && styles.labelRead]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        <View style={styles.whenWrap}>
          <Text style={styles.when}>{when}</Text>
          <View style={[styles.dot, read && styles.dotRead]} />
        </View>
      </View>
      <Text style={[styles.title, read && styles.titleRead]} numberOfLines={2}>
        {notice.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
    overflow: 'hidden',
  },
  read: { backgroundColor: 'transparent' },
  pinned: { borderColor: colors.forest, paddingLeft: 17 },
  pinEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.forest },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.amberDk },
  labelRead: { color: colors.faint },
  whenWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  when: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dot },
  dotRead: { backgroundColor: 'transparent' },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20, color: colors.ink },
  titleRead: { fontFamily: fonts.bodyMedium, color: colors.muted },
});
