import { Check } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Display } from '@/theme/type';
import { colors, fonts } from '@/theme/tokens';

import { Mark } from './Mark';

export type LaunchStepState = 'done' | 'now' | 'todo';
export type LaunchStep = { label: string; state: LaunchStepState };

/** Example steps for a buyer's first launch. */
export const DEFAULT_LAUNCH_STEPS: LaunchStep[] = [
  { label: 'Signed in', state: 'done' },
  { label: 'Tower A, 1204 found', state: 'done' },
  { label: 'Loading latest updates', state: 'now' },
  { label: 'Saving them for offline', state: 'todo' },
];

/** First-launch progress screen shown after the splash. */
export function LaunchLoading({ steps = DEFAULT_LAUNCH_STEPS }: { steps?: LaunchStep[] }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Mark size={46} />
        <Display size={30} em="your unit." style={styles.title}>
          Opening
        </Display>
        <View style={styles.steps} accessibilityRole="progressbar">
          {steps.map((s) => (
            <View key={s.label} style={styles.step}>
              <StepDot state={s.state} />
              <Text style={[styles.stepText, s.state === 'now' && styles.stepNow]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StepDot({ state }: { state: LaunchStepState }) {
  if (state === 'now') {
    return <ActivityIndicator size="small" color={colors.forest} style={styles.dot} />;
  }
  if (state === 'done') {
    return (
      <View style={[styles.dot, styles.dotDone]}>
        <Check size={11} color={colors.white} strokeWidth={3} />
      </View>
    );
  }
  return <View style={[styles.dot, styles.dotTodo]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 40 },
  title: { textAlign: 'center' },
  steps: { gap: 11, width: 230, marginTop: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.forest },
  dotTodo: { backgroundColor: colors.inset },
  stepText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  stepNow: { fontFamily: fonts.bodySemibold, color: colors.ink },
});
