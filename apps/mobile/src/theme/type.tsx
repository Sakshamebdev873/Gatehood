import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from './tokens';

type DisplayProps = TextProps & {
  children: ReactNode;
  /** Second line, set in italic forest green. */
  em?: string;
  size?: number;
};

/** Serif headline, with an optional italic green second line. */
export function Display({ children, em, size = 34, style, ...rest }: DisplayProps) {
  return (
    <Text
      accessibilityRole="header"
      style={[styles.display, { fontSize: size, lineHeight: size * 1.02 }, style]}
      {...rest}
    >
      {children}
      {em ? (
        <>
          {'\n'}
          <Text style={styles.em}>{em}</Text>
        </>
      ) : null}
    </Text>
  );
}

/** Small mono capitals label in amber. */
export function Eyebrow({ style, children, ...rest }: TextProps) {
  return (
    <Text style={[styles.eyebrow, style]} {...rest}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

/** Body copy. `muted` uses the secondary text colour. */
export function Body({ muted, style, ...rest }: TextProps & { muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: fonts.display,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  em: {
    fontFamily: fonts.displayItalic,
    color: colors.forest,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.amberDk,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  muted: { color: colors.muted },
});
