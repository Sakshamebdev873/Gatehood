import type { BuyersResponse, BuyerStatus, OverviewResponse } from '@gatehood/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, Share2, Upload, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';
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

/** Lower case, no spaces or dashes, so "a1204" finds A-1204 and "a1204 7kq" finds A1204-7KQ. */
const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '');

function matches(b: Buyer, query: string): boolean {
  const q = squash(query);
  return !q || squash(b.name).includes(q) || squash(b.unitId).includes(q) || squash(b.code).includes(q);
}

/** Opens the share sheet (WhatsApp, SMS…) with the buyer's code and how to use it. */
function shareCode(b: Buyer) {
  Share.share({
    message: `Hi ${b.name}, your Gatehood invite code for unit ${b.unitId} is ${b.code}. Open the Gatehood Updates app and enter it to get your home's updates.`,
  }).catch(() => undefined);
}

/** Every invited buyer with their code and whether they have joined, filtered by tower. */
export default function Buyers() {
  // The tower lives in the URL so the Towers tab can open this list on one tower.
  const params = useLocalSearchParams<{ tower?: string }>();
  const tower = typeof params.tower === 'string' && params.tower ? params.tower : 'all';
  const setTower = (t: string) => router.setParams({ tower: t === 'all' ? '' : t });
  const [query, setQuery] = useState('');
  const overview = useApiData<OverviewResponse>('/api/builder/overview');
  const buyers = useApiData<BuyersResponse>(
    tower === 'all' ? '/api/builder/buyers' : `/api/builder/buyers?tower=${encodeURIComponent(tower)}`,
  );
  const towerIds = overview.data?.towers.map((t) => t.towerId) ?? ['A', 'B', 'C'];
  const filters = [{ value: 'all', label: 'All' }, ...towerIds.map((id) => ({ value: id, label: id }))];
  const all = buyers.data?.buyers ?? [];
  const rows = query ? all.filter((b) => matches(b, query)) : all;
  const joined = all.filter((b) => b.status === 'joined').length;

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
  } else if (rows.length === 0 && all.length > 0) {
    body = (
      <View style={styles.pad}>
        <Empty title="No buyer matches" em={`“${query.trim()}”.`} body="Search by name, unit like A-1204, or invite code." />
      </View>
    );
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <BuyerRow buyer={item} />}
        refreshControl={
          <RefreshControl refreshing={buyers.refreshing} onRefresh={buyers.refresh} tintColor={colors.forest} colors={[colors.forest]} />
        }
        ListHeaderComponent={
          <Text style={styles.count}>
            {query
              ? `${rows.length} of ${all.length} ${all.length === 1 ? 'buyer' : 'buyers'}`
              : `${all.length} ${all.length === 1 ? 'buyer' : 'buyers'} · ${joined} joined`}
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
        <View style={styles.search}>
          <Search size={17} color={colors.faint} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel="Search buyers"
            value={query}
            onChangeText={setQuery}
            placeholder="Name, unit or code"
            placeholderTextColor={colors.faint}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={10}>
              <X size={17} color={colors.muted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.flex}>{body}</View>
    </SafeAreaView>
  );
}

function BuyerRow({ buyer }: { buyer: Buyer }) {
  const chip = CHIP[buyer.status];
  const label = STATUS_LABEL[buyer.status];
  return (
    <View style={styles.row}>
      <View
        style={styles.rowText}
        accessible
        accessibilityLabel={`${buyer.name}, unit ${buyer.unitId}, code ${buyer.code}, ${label}`}
      >
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
      {buyer.status === 'pending' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Send ${buyer.name} their invite code`}
          onPress={() => shareCode(buyer)}
          hitSlop={8}
          style={({ pressed }) => [styles.share, pressed && styles.pressed]}
        >
          <Share2 size={16} color={colors.forest} strokeWidth={2} />
        </Pressable>
      ) : null}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  share: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
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
  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
