import { View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** The Gatehood three-towers mark on a forest tile. */
export function Mark({ size = 84 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="Gatehood"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.225,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.forest,
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 48 48">
        <G fill={colors.ivory}>
          <Rect x={8} y={20} width={9} height={20} rx={1.5} />
          <Rect x={19.5} y={9} width={9} height={31} rx={1.5} />
          <Rect x={31} y={15} width={9} height={25} rx={1.5} />
        </G>
        <Circle cx={35.5} cy={8.5} r={4.5} fill={colors.amber} />
      </Svg>
    </View>
  );
}
