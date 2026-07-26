import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Animated, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getTailoringJobs, getTailoringStats, updateTailoringStatus } from '../../api/clothing';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const STATUS_FILTERS = ['All', 'Received', 'In Progress', 'Stitched', 'Delivered'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_COLORS: Record<string, string> = {
    received: '#4C8EFF',
    'in progress': '#F59E0B',
    stitched: '#9B59B6',
    delivered: '#2DD479',
};

const STATUS_ICONS: Record<string, any> = {
    received: 'download-outline',
    'in progress': 'cut-outline',
    stitched: 'checkmark-circle-outline',
    delivered: 'bag-check-outline',
};

export default function TailoringScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    const [jobs, setJobs] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [activeFilter, setActiveFilter] = useState<StatusFilter>('All');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const listAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        else setRefreshing(true);

        try {
            const statusParam = activeFilter === 'All' ? undefined : activeFilter.toLowerCase();
            const [jobsRes, statsRes] = await Promise.all([
                getTailoringJobs(statusParam),
                getTailoringStats(),
            ]);
            setJobs(jobsRes.data.data || []);
            setStats(statsRes.data.data || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }, [activeFilter, listAnim]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleQuickAction = (job: any) => {
        const status = job.status?.toLowerCase();
        const nextStatus: Record<string, string> = {
            received: 'In Progress',
            'in progress': 'Stitched',
            stitched: 'Delivered',
        };
        const next = nextStatus[status];
        if (!next) return;

        Alert.alert(
            'Update Status',
            `Mark job #${job.token} as "${next}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async () => {
                        try {
                            await updateTailoringStatus(job.id, next);
                            fetchData(true);
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'Failed to update status.');
                        }
                    },
                },
            ]
        );
    };

    const getStatusColor = (status: string) => STATUS_COLORS[status?.toLowerCase()] || colors.textMuted;
    const getStatusIcon = (status: string) => STATUS_ICONS[status?.toLowerCase()] || 'ellipse-outline';

    const isOverdue = (deliveryDate: string) => {
        if (!deliveryDate) return false;
        return new Date(deliveryDate) < new Date() &&
            !['delivered'].includes(('' as any)?.toLowerCase?.() || '');
    };

    const renderJobCard = ({ item }: any) => {
        const statusColor = getStatusColor(item.status);
        const statusIcon = getStatusIcon(item.status);
        const statusKey = item.status?.toLowerCase();
        const nextStatus: Record<string, string> = {
            received: 'In Progress',
            'in progress': 'Stitched',
            stitched: 'Delivered',
        };
        const hasNextAction = !!nextStatus[statusKey];

        const deliveryDate = item.deliveryDate ? new Date(item.deliveryDate) : null;
        const isPast = deliveryDate && deliveryDate < new Date() && statusKey !== 'delivered';

        return (
            <TouchableOpacity
                style={themedStyles.card}
                onPress={() => navigation.navigate('TailoringDetail', { jobId: item.id })}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.04)', 'transparent'] : ['rgba(0,0,0,0.02)', 'transparent']}
                    style={themedStyles.cardGradient}
                >
                    {/* Top Row: Token + Status */}
                    <View style={themedStyles.cardTop}>
                        <View style={themedStyles.tokenWrap}>
                            <Ionicons name="pricetag-outline" size={13} color={colors.primary} />
                            <Text style={themedStyles.tokenText}>#{item.token}</Text>
                        </View>
                        <View style={[themedStyles.statusBadge, { backgroundColor: statusColor + '26' }]}>
                            <Ionicons name={statusIcon} size={11} color={statusColor} />
                            <Text style={[themedStyles.statusText, { color: statusColor }]}>
                                {item.status}
                            </Text>
                        </View>
                    </View>

                    {/* Customer Info */}
                    <View style={themedStyles.customerRow}>
                        <View style={[themedStyles.avatar, { backgroundColor: colors.primary }]}>
                            <Text style={themedStyles.avatarText}>{item.customerName?.[0] || '?'}</Text>
                        </View>
                        <View style={themedStyles.customerInfo}>
                            <Text style={themedStyles.customerName}>{item.customerName}</Text>
                            <Text style={themedStyles.customerPhone}>{item.customerPhone}</Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={[themedStyles.divider, { backgroundColor: colors.border }]} />

                    {/* Footer: Delivery date + Action */}
                    <View style={themedStyles.cardBottom}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons
                                name="calendar-outline"
                                size={13}
                                color={isPast ? colors.error : colors.textMuted}
                            />
                            <Text style={[themedStyles.deliveryText, isPast && { color: colors.error }]}>
                                {deliveryDate
                                    ? deliveryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : 'No date set'}
                            </Text>
                        </View>
                        {hasNextAction ? (
                            <TouchableOpacity
                                style={themedStyles.actionBtn}
                                onPress={() => handleQuickAction(item)}
                            >
                                <LinearGradient colors={gradients.primary} style={themedStyles.actionBtnGrad}>
                                    <Text style={themedStyles.actionBtnText}>
                                        → {nextStatus[statusKey]}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : statusKey === 'delivered' ? (
                            <View style={[themedStyles.statusBadge, { backgroundColor: colors.success + '26' }]}>
                                <Ionicons name="checkmark-done" size={12} color={colors.success} />
                                <Text style={[themedStyles.statusText, { color: colors.success }]}>Done</Text>
                            </View>
                        ) : null}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>

                {/* Header */}
                <View style={themedStyles.header}>
                    <View>
                        <Text style={themedStyles.title}>Tailoring</Text>
                        <Text style={themedStyles.subtitle}>Job management</Text>
                    </View>
                    <TouchableOpacity
                        style={themedStyles.searchBtn}
                        onPress={() => navigation.navigate('TokenLookup')}
                    >
                        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <Animated.View style={[themedStyles.statsRow, { opacity: listAnim }]}>
                    {[
                        { label: 'Received', key: 'received', color: '#4C8EFF' },
                        { label: 'In Progress', key: 'inProgress', color: '#F59E0B' },
                        { label: 'Stitched', key: 'stitched', color: '#9B59B6' },
                        { label: 'Delivered', key: 'delivered', color: '#2DD479' },
                    ].map(s => (
                        <View key={s.key} style={themedStyles.statCard}>
                            <Text style={[themedStyles.statVal, { color: s.color }]}>
                                {stats?.[s.key] ?? 0}
                            </Text>
                            <Text style={themedStyles.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </Animated.View>

                {/* Filter Tabs */}
                <FlatList
                    data={STATUS_FILTERS as unknown as StatusFilter[]}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[themedStyles.filterTab, activeFilter === item && themedStyles.filterActive]}
                            onPress={() => setActiveFilter(item)}
                        >
                            <Text style={[themedStyles.filterText, activeFilter === item && themedStyles.filterTextActive]}>
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={i => i}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={themedStyles.filterRow}
                    style={{ maxHeight: 48 }}
                />

                {/* Jobs List */}
                <Animated.View style={{ flex: 1, opacity: listAnim }}>
                    <FlatList
                        data={jobs}
                        renderItem={renderJobCard}
                        keyExtractor={i => String(i.id)}
                        contentContainerStyle={themedStyles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => fetchData(true)}
                                tintColor={colors.primary}
                            />
                        }
                        ListEmptyComponent={
                            <View style={themedStyles.center}>
                                <Ionicons name="cut-outline" size={48} color={colors.textMuted} />
                                <Text style={themedStyles.emptyTitle}>No jobs found</Text>
                                <Text style={themedStyles.emptySubtitle}>
                                    {activeFilter !== 'All' ? `No "${activeFilter}" jobs.` : 'Tap + to create a new job.'}
                                </Text>
                            </View>
                        }
                    />
                </Animated.View>
            </SafeAreaView>

            {/* FAB */}
            <TouchableOpacity
                style={[themedStyles.fab, Shadows.glow]}
                onPress={() => navigation.navigate('NewTailoringJob')}
                activeOpacity={0.85}
            >
                <LinearGradient colors={gradients.primary} style={themedStyles.fabGrad}>
                    <Ionicons name="add" size={28} color={colors.textInverse} />
                </LinearGradient>
            </TouchableOpacity>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    },
    title: { ...Typography.h2, color: colors.textPrimary, fontWeight: '900' },
    subtitle: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    searchBtn: {
        width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass,
    },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.lg },
    statCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.sm,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
        alignItems: 'center', ...Shadows.sm,
    },
    statVal: { ...Typography.h4, fontWeight: '900', color: colors.textPrimary },
    statLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', textAlign: 'center', marginTop: 2 },

    // Filter
    filterRow: { paddingHorizontal: Spacing.lg, gap: 8, paddingBottom: Spacing.md },
    filterTab: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary + '1F', borderColor: colors.primary },
    filterText: { ...Typography.buttonSm, color: colors.textMuted },
    filterTextActive: { color: colors.primary },

    // List
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
    card: {
        borderRadius: Radius.xl, marginBottom: Spacing.md, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.sm,
    },
    cardGradient: { padding: Spacing.lg },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    tokenWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tokenText: { ...Typography.h5, color: colors.primary, fontWeight: '900' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
    customerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#000', fontSize: 14, fontWeight: '900' },
    customerInfo: { flex: 1 },
    customerName: { ...Typography.body1, color: colors.textPrimary, fontWeight: '800' },
    customerPhone: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.sm },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    deliveryText: { ...Typography.caption, color: colors.textMuted, fontWeight: '700' },
    actionBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.sm },
    actionBtnGrad: { paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { fontSize: 11, fontWeight: '900', color: colors.textInverse },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 12 },
    emptyTitle: { ...Typography.h4, color: colors.textMuted },
    emptySubtitle: { ...Typography.caption, color: colors.textMuted, textAlign: 'center' },

    // FAB
    fab: {
        position: 'absolute', bottom: 100, right: Spacing.xl,
        borderRadius: 30, overflow: 'hidden',
    },
    fabGrad: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
});
