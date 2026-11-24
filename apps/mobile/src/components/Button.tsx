import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
};

/** Pill button. Primary is solid forest; ghost is outlined. */
export function Button({ title, variant = 'primary', loading, disabled, ...rest }: ButtonProps) {
  const ghost = variant === 'ghost';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        ghost ? styles.ghost : styles.primary,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={ghost ? colors.forest : colors.white} />
      ) : (
        <Text style={[styles.label, ghost && styles.ghostLabel]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primary: { backgroundColor: colors.forest },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.white },
  ghostLabel: { color: colors.forest },
});
