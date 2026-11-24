import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius } from '@/theme/tokens';

/** White rounded surface with a hairline border. */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.card,
    padding: 14,
  },
});
