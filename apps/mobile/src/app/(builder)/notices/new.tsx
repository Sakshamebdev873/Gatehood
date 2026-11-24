import type { OverviewResponse } from '@gatehood/shared';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef, type Ref } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/BackLink';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { useApiData } from '@/features/builder/hooks';
import { buildNoticeRequest, targetLabel, type AudienceMode, type DraftErrors } from '@/features/builder/logic';
import { api, ApiError, NETWORK_MESSAGE } from '@/lib/api';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

const MODES = [
  { value: 'all', label: 'Whole project' },
  { value: 'towers', label: 'Towers' },
  { value: 'units', label: 'Units' },
] as const satisfies readonly { value: AudienceMode; label: string }[];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/notices');
}

type NoticeRequest = Extract<ReturnType<typeof buildNoticeRequest>, { ok: true }>['request'];
type TowerOverview = OverviewResponse['towers'][number];

/** "everyone in all 3 towers (240 units)", "Tower A (80 units)", "units A-1204, B-0302". */
function audienceSummary(target: NoticeRequest['target'], towers: TowerOverview[]): string {
  const units = (ids: string[]) => {
    const n = towers.filter((t) => ids.includes(t.towerId)).reduce((sum, t) => sum + t.units, 0);
    return n > 0 ? ` (${n} units)` : '';
  };
  if (target.type === 'all') {
    const all = towers.map((t) => t.towerId);
    return all.length > 0 ? `everyone in all ${all.length} towers${units(all)}` : 'everyone in the project';
  }
  if (target.type === 'towers') return `${targetLabel(target)}${units(target.towers)}`;
  return targetLabel(target).replace(/^Unit/, 'unit');
}

/** Write a notice, choose who gets it, optionally pin it, and post. */
export default function NewNotice() {
  const overview = useApiData<OverviewResponse>('/api/builder/overview');
  const towerIds = overview.data?.towers.map((t) => t.towerId) ?? [];

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<AudienceMode>('all');
  const [towers, setTowers] = useState<string[]>([]);
  const [unitsText, setUnitsText] = useState('');
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const bodyRef = useRef<ComponentRef<typeof TextInput>>(null);

  const clear = (field: keyof DraftErrors) => {
    setServerError(null);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const toggleTower = (id: string) => {
    clear('audience');
    setTowers((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };

  const send = async (request: NoticeRequest) => {
    setPosting(true);
    try {
      await api<{ id: string }>('/api/builder/notices', { method: 'POST', body: request });
      goBack();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : NETWORK_MESSAGE);
      setPosting(false);
    }
  };

  // A notice can't be edited or deleted once posted, so name who gets it and ask first.
  const post = () => {
    const built = buildNoticeRequest({ title, body, pinned, mode, towers, unitsText });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setServerError(null);
    const who = audienceSummary(built.request.target, overview.data?.towers ?? []);
    Alert.alert(
      built.request.pinned ? 'Post and pin this notice?' : 'Post this notice?',
      `It goes to ${who} right away. Notices can't be edited or deleted after posting.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Post', onPress: () => void send(built.request) },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackLink label="Notices" onPress={goBack} />
          <Eyebrow>New notice</Eyebrow>
          <Display em="to buyers.">Post an update</Display>

          <Field
            label="Title"
            error={errors.title}
            value={title}
            onChangeText={(v) => {
              clear('title');
              setTitle(v);
            }}
            placeholder="Water supply off Thursday, 10am to 2pm"
            maxLength={140}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => bodyRef.current?.focus()}
          />
          <Field
            ref={bodyRef}
            label="Text"
            error={errors.body}
            value={body}
            onChangeText={(v) => {
              clear('body');
              setBody(v);
            }}
            placeholder="What buyers need to know, and what to do."
            multiline
            style={styles.bodyInput}
            textAlignVertical="top"
          />

          <View style={styles.group}>
            <Text style={styles.label}>Who gets it</Text>
            <Segmented
              options={MODES}
              value={mode}
              onChange={(m) => {
                clear('audience');
                setMode(m);
              }}
            />
            {mode === 'towers' ? (
              <View style={styles.chips}>
                {towerIds.length === 0 ? <Body muted>Loading towers…</Body> : null}
                {towerIds.map((id) => {
                  const on = towers.includes(id);
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Tower ${id}`}
                      onPress={() => toggleTower(id)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>Tower {id}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {mode === 'units' ? (
              <TextInput
                accessibilityLabel="Units"
                value={unitsText}
                onChangeText={(v) => {
                  clear('audience');
                  setUnitsText(v);
                }}
                placeholder="A-1204, B-0302"
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, styles.mono, errors.audience && styles.inputError]}
              />
            ) : null}
            {mode === 'units' && !errors.audience ? (
              <Text style={styles.hint}>Separate units with commas.</Text>
            ) : null}
            {errors.audience ? <Text style={styles.error}>{errors.audience}</Text> : null}
          </View>

          <View style={styles.pinRow}>
            <View style={styles.flex}>
              <Text style={styles.pinTitle}>Pin to the top</Text>
              <Text style={styles.hint}>Stays above newer notices in buyers&apos; feeds.</Text>
            </View>
            <Switch
              accessibilityLabel="Pin to the top"
              value={pinned}
              onValueChange={setPinned}
              trackColor={{ true: colors.forest, false: colors.switchOff }}
              thumbColor={colors.white}
            />
          </View>

          {serverError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {serverError}
            </Text>
          ) : null}
          <Button title="Post notice" loading={posting} onPress={post} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string; ref?: Ref<ComponentRef<typeof TextInput>> };

function Field({ label, error, style, ...input }: FieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.faint}
        style={[styles.input, style, error && styles.inputError]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  content: { padding: 22, gap: 16, paddingBottom: 40 },
  group: { gap: 8 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: colors.muted, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  bodyInput: { minHeight: 140 },
  mono: { fontFamily: fonts.mono, letterSpacing: 0.5 },
  inputError: { borderColor: colors.error },
  error: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.error },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.white },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: 14,
  },
  pinTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
});
