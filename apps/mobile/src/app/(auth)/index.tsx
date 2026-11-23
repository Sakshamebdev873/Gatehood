import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Mark';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors } from '@/theme/tokens';

/** Join screen. Phase 09 replaces this with the invite-code form. */
export default function Join() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Mark size={56} />
        <Eyebrow>Buyer access</Eyebrow>
        <Display em="home's updates.">Join your</Display>
        <Body muted>Enter the invite code from your allotment letter to see your tower&rsquo;s updates.</Body>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  body: { flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
});
