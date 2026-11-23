import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Display, Eyebrow } from '@/theme/type';
import { colors } from '@/theme/tokens';

import { Button } from './Button';
import { Empty } from './StateViews';

type PlaceholderProps = { eyebrow: string; title: string; em: string; children?: ReactNode };

/** Temporary tab screen until its phase builds the real one. Includes sign out for testing routing. */
export function Placeholder({ eyebrow, title, em, children }: PlaceholderProps) {
  const { signOut } = useAuth();
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display em={em}>{title}</Display>
        {children ?? <Empty title="Nothing here" em="yet." body="This screen is coming soon." />}
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 22, gap: 14 },
});
