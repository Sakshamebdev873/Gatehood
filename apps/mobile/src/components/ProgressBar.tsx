import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme/tokens';

type ProgressBarProps = {
  /** 0–100. */
  value: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
};

/** Thin rounded bar, filled to `value` percent. */
export function ProgressBar({ value, height = 6, color = colors.forest, style }: ProgressBarProps) {
  const width = `${Math.min(100, Math.max(0, value))}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={[styles.track, { height }, style]}
    >
      <View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.inset, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
