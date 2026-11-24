import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

type BackLinkProps = {
  /** Where Back goes, e.g. "Updates". Read as "Back to Updates". */
  label: string;
  onPress: () => void;
};

/** The one back control used at the top of every pushed screen. */
export function BackLink({ label, onPress }: BackLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Back' ? 'Back' : `Back to ${label}`}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <ChevronLeft size={20} color={colors.forest} strokeWidth={2} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44, marginLeft: -4 },
  pressed: { opacity: 0.6 },
  text: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.forest },
});
