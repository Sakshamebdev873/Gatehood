import { parseBuyersCsv, type ImportResult, type ParsedBuyers } from '@gatehood/shared';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { ChevronLeft, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { api, ApiError, NETWORK_MESSAGE } from '@/lib/api';
import { Body, Display, Eyebrow } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

/** Same limit as ImportRequest on the server. */
const MAX_CSV_CHARS = 1_000_000;

type Step =
  | { kind: 'pick'; error?: string }
  | { kind: 'preview'; name: string; csv: string; parsed: ParsedBuyers; posting: boolean; error?: string }
  | { kind: 'done'; result: ImportResult };

async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/buyers');
}

/** Pick a buyers CSV, check it on the phone, import it, then hand out the new codes. */
export default function ImportBuyers() {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [picking, setPicking] = useState(false);

  const pick = async () => {
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const csv = await readPicked(asset);
      if (csv.length > MAX_CSV_CHARS) {
        setStep({ kind: 'pick', error: 'This file is over 1 MB. Split it into smaller files and import each one.' });
        return;
      }
      setStep({ kind: 'preview', name: asset.name, csv, parsed: parseBuyersCsv(csv), posting: false });
    } catch {
      setStep({ kind: 'pick', error: "Couldn't open that file. Pick a .csv file saved on this phone." });
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (step.kind !== 'preview') return;
    setStep({ ...step, posting: true, error: undefined });
    try {
      const result = await api<ImportResult>('/api/builder/import', { method: 'POST', body: { csv: step.csv } });
      setStep({ kind: 'done', result });
    } catch (err) {
      setStep({ ...step, posting: false, error: err instanceof ApiError ? err.message : NETWORK_MESSAGE });
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.back} hitSlop={8}>
          <ChevronLeft size={18} color={colors.forest} strokeWidth={2} />
          <Text style={styles.backText}>Buyers</Text>
        </Pressable>
        <Eyebrow>Import buyers</Eyebrow>
        {step.kind === 'pick' ? <PickStep picking={picking} error={step.error} onPick={pick} /> : null}
        {step.kind === 'preview' ? <PreviewStep step={step} onImport={submit} onPickAgain={pick} /> : null}
        {step.kind === 'done' ? <DoneStep result={step.result} onFinish={goBack} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PickStep({ picking, error, onPick }: { picking: boolean; error?: string; onPick: () => void }) {
  return (
    <>
      <Display em="send invite codes.">Import a CSV,</Display>
      <Card style={styles.gap}>
        <Body muted>One row per buyer. Columns, in any order:</Body>
        <Text style={styles.code}>tower,unit,name,phone,config</Text>
        <Body muted>config (like 3BHK) is optional. You can check the file before anything is saved.</Body>
      </Card>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button title="Choose CSV file" loading={picking} onPress={onPick} />
    </>
  );
}

function PreviewStep({
  step,
  onImport,
  onPickAgain,
}: {
  step: Extract<Step, { kind: 'preview' }>;
  onImport: () => void;
  onPickAgain: () => void;
}) {
  const { rows, errors } = step.parsed;
  const n = rows.length;
  return (
    <>
      <Display em={n === 1 ? '1 buyer.' : `${n} buyers.`}>Ready to import</Display>
      <View style={styles.file}>
        <FileText size={16} color={colors.muted} strokeWidth={1.8} />
        <Text style={styles.fileName} numberOfLines={1}>
          {step.name}
        </Text>
      </View>
      <Card style={styles.gap}>
        <View style={styles.row}>
          <Text style={styles.big}>{n}</Text>
          <Body muted>{n === 1 ? 'row is ready' : 'rows are ready'}</Body>
        </View>
        {errors.length > 0 ? (
          <>
            <Text style={styles.eye}>
              {errors.length} {errors.length === 1 ? 'row has' : 'rows have'} a problem · won&apos;t be imported
            </Text>
            {errors.map((e) => (
              <View key={`${e.line}-${e.reason}`} style={styles.errRow}>
                <Text style={styles.line}>Line {e.line}</Text>
                <Text style={styles.reason}>{e.reason}</Text>
              </View>
            ))}
          </>
        ) : (
          <Body muted>No problems found.</Body>
        )}
      </Card>
      {n === 0 ? (
        <Body muted>Nothing to import. Fix the rows above in the file and pick it again.</Body>
      ) : (
        <Body muted>Buyers already invited for the same unit and phone are skipped.</Body>
      )}
      {step.error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {step.error}
        </Text>
      ) : null}
      <Button
        title={n === 1 ? 'Import 1 buyer' : `Import ${n} buyers`}
        disabled={n === 0}
        loading={step.posting}
        onPress={onImport}
      />
      <Button title="Pick another file" variant="ghost" disabled={step.posting} onPress={onPickAgain} />
    </>
  );
}

function DoneStep({ result, onFinish }: { result: ImportResult; onFinish: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
  };
  const all = result.invites.map((i) => `${i.name} (${i.unitId}): ${i.code}`).join('\n');

  return (
    <>
      <Display em={result.created === 1 ? '1 new code.' : `${result.created} new codes.`}>Imported</Display>
      <Body muted>
        {result.skipped > 0 ? `${result.skipped} already invited, skipped. ` : ''}
        Send each buyer their code. They type it on the join screen.
      </Body>
      {result.errors.length > 0 ? (
        <Card style={styles.gap}>
          <Text style={styles.eye}>Not imported · {result.errors.length}</Text>
          {result.errors.map((e) => (
            <View key={`${e.line}-${e.reason}`} style={styles.errRow}>
              <Text style={styles.line}>Line {e.line}</Text>
              <Text style={styles.reason}>{e.reason}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {result.invites.length > 0 ? (
        <Card style={styles.codes}>
          {result.invites.map((i) => (
            <View key={i.code} style={styles.codeRow}>
              <View style={styles.flex}>
                <Text style={styles.codeText}>{i.code}</Text>
                <Text style={styles.who} numberOfLines={1}>
                  {i.name} · {i.unitId}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy code for ${i.name}`}
                onPress={() => void copy(i.code, i.code)}
                style={styles.copy}
                hitSlop={6}
              >
                <Text style={styles.copyText}>{copied === i.code ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
      {result.invites.length > 1 ? (
        <Button
          title={copied === '*' ? 'Copied all codes' : 'Copy all codes'}
          variant="ghost"
          onPress={() => void copy('*', all)}
        />
      ) : null}
      <Button title="Done" onPress={onFinish} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 22, gap: 14, paddingBottom: 40 },
  flex: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.forest },
  gap: { gap: 8 },
  code: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.ink,
    backgroundColor: colors.inset,
    borderRadius: 8,
    padding: 10,
  },
  error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.error },
  file: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fileName: { flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontFamily: fonts.display, fontSize: 40, color: colors.ink },
  eye: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.amberDk, marginTop: 4 },
  errRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  line: { width: 58, fontFamily: fonts.mono, fontSize: 12, color: colors.error },
  reason: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  codes: { paddingVertical: 4 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  codeText: { fontFamily: fonts.monoMedium, fontSize: 16, letterSpacing: 1, color: colors.ink },
  who: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  copy: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  copyText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.forest },
});
