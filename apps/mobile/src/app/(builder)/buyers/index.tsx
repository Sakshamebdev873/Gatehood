import type { BuyersResponse, BuyerStatus, OverviewResponse } from '@gatehood/shared';
import { router } from 'expo-router';
import { Upload } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { Empty, ErrorRetry, LoadingCards } from '@/components/StateViews';
import { useApiData } from '@/features/builder/hooks';
import { STATUS_LABEL } from '@/features/builder/logic';
import { Display } from '@/theme/type';
import { colors, fonts, radius } from '@/theme/tokens';

type Buyer = BuyersResponse['buyers'][number];

const CHIP: Record<BuyerStatus, { bg: string; fg: string }> = {
  joined: { bg: '#E3EFE8', fg: colors.forestDk },
  pending: { bg: '#FDEBDC', fg: colors.amberDk },
  expired: { bg: colors.inset, fg: colors.faint },
};

/** Every invited buyer with their code and whether they have joined, filtered by tower. */
export default function Buyers() {
  const [tower, setTower] = useState('all');
  const overview = useApiData<OverviewResponse>('/api/builder/overview');
  const buyers = useApiData<BuyersResponse>(
    tower === 'all' ? '/api/builder/buyers' : `/api/builder/buyers?tower=${encodeURIComponent(tower)}`,
  );
  const towerIds = overview.data?.towers.map((t) => t.towerId) ?? ['A', 'B', 'C'];
  const filters = [{ value: 'all', label: 'All' }, ...towerIds.map((id) => ({ value: id, label: id }))];
  const rows = buyers.data?.buyers ?? [];
  const joined = rows.filter((b) => b.status === 'joined').length;

  const openImport = () => router.push('/buyers/import');

  let body: ReactNode;
  if (buyers.status === 'loading') {
    body = (
      <View style={styles.pad}>
        <LoadingCards count={4} />
      </View>
    );
  } else if (buyers.status === 'error') {
    body = <ErrorRetry title="Couldn't load buyers" body={buyers.error} onRetry={buyers.reload} />;
  } else if (rows.length === 0) {
    body = (
      <View style={styles.pad}>
        <Empty
          title="No buyers"
          em={tower === 'all' ? 'yet.' : `in Tower ${tower} yet.`}
          body="Import a CSV to send invite codes."
        />
        <Button title="Import CSV" onPress={openImport} />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={rows}
        keyExtractor={(b) => b.code}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <BuyerRow buyer={item} />}
        refreshControl={
          <RefreshControl refreshing={buyers.refreshing} onRefresh={buyers.refresh} tintColor={colors.forest} colors={[colors.forest]} />
        }
        ListHeaderComponent={
          <Text style={styles.count}>
            {rows.length} {rows.length === 1 ? 'buyer' : 'buyers'} · {joined} joined
          </Text>
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topbar}>
          <Display size={30}>Buyers</Display>
          <Pressable accessibilityRole="button" onPress={openImport} style={styles.importBtn} hitSlop={6}>
            <Upload size={15} color={colors.forest} strokeWidth={2} />
            <Text style={styles.importText}>Import CSV</Text>
          </Pressable>
        </View>
        <Segmented options={filters} value={tower} onChange={setTower} />
      </View>
      <View style={styles.flex}>{body}</View>
    </SafeAreaView>
  );
}

function BuyerRow({ buyer }: { buyer: Buyer }) {
  const chip = CHIP[buyer.status];
  const label = STATUS_LABEL[buyer.status];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${buyer.name}, unit ${buyer.unitId}, code ${buyer.code}, ${label}`}>
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>
          {buyer.name}
        </Text>
        <Text style={styles.mono}>
          {buyer.unitId} · {buyer.code}
        </Text>
      </View>
      <Text style={[styles.chip, { backgroundColor: chip.bg, color: chip.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6, gap: 12 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  importText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.forest },
  pad: { paddingHorizontal: 22, paddingTop: 8 },
  list: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 28, gap: 6 },
  count: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, color: colors.faint, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.muted },
  chip: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11.5,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
});
