import { Bell, Building2, House, Megaphone, Users } from 'lucide-react-native';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

const icons = {
  home: House,
  updates: Bell,
  towers: Building2,
  notices: Megaphone,
  buyers: Users,
} as const;

export type TabIconName = keyof typeof icons;

/** Shared tab bar look for the buyer and builder tab layouts. */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.forest,
  tabBarInactiveTintColor: colors.faint,
  tabBarStyle: { backgroundColor: colors.ivory, borderTopColor: colors.line },
  tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  sceneStyle: { backgroundColor: colors.ivory },
} as const;

type TabIconProps = {
  name: TabIconName;
  color: ColorValue;
  focused: boolean;
  /** Unread count. Hidden when 0 or missing; shows 99+ above 99. */
  badge?: number;
};

export function TabIcon({ name, color, focused, badge }: TabIconProps) {
  const Icon = icons[name];
  return (
    <View style={styles.wrap}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.1 : 1.7} />
      {badge ? (
        <View style={styles.badge} accessibilityLabel={`${badge} unread`}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 26, height: 24, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.dot,
    borderWidth: 2,
    borderColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 9, color: colors.white, lineHeight: 11 },
});
