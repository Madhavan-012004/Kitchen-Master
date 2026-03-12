import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    Dimensions, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { analyticsAPI } from '../../api/analytics';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

const W = Dimensions.get('window').width;

const PERIODS = ['Today', 'Week', 'Month'] as const;
type Period = typeof PERIODS[number];

export default function AnalyticsScreen() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('Today');

    useEffect(() => {
        const fetch = async () => {
            try {
                const periodMap: Record<Period, '1d' | '7d' | '30d'> = {
                    'Today': '1d',
                    'Week': '7d',
                    'Month': '30d'
                };
                const res = await analyticsAPI.getSales(periodMap[period]);
                setData(res.data.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [period]);

    if (loading) return (
        <LinearGradient colors={Gradients.background} style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
        </LinearGradient>
    );

    const summary = data?.summary || {};
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    const kpis = [
        { label: 'Revenue', value: `₹${summary.totalRevenue || 0}`, icon: 'cash-outline', grad: ['#FF8A5C', '#FF6B35'] as const, shadow: Shadows.primary },
        { label: 'Orders', value: String(summary.totalOrders || 0), icon: 'receipt-outline', grad: ['#4C8EFF', '#2563EB'] as const, shadow: Shadows.blue },
        { label: 'Avg Bill', value: `₹${Math.round(summary.avgOrderValue || 0)}`, icon: 'trending-up-outline', grad: ['#00D68F', '#00B377'] as const, shadow: Shadows.green },
    ];

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Analytics</Text>
                            <Text style={styles.dateText}>{today}</Text>
                        </View>
                        <TouchableOpacity style={styles.exportBtn}>
                            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Period Selector */}
                    <View style={styles.periodRow}>
                        {PERIODS.map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.periodTab, period === p && styles.periodActive]}
                                onPress={() => setPeriod(p)}
                            >
                                {period === p && (
                                    <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />
                                )}
                                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* KPI Cards */}
                    <View style={styles.kpiRow}>
                        {kpis.map((k, i) => (
                            <LinearGradient key={i} colors={k.grad} style={[styles.kpiCard, k.shadow]}>
                                <View style={styles.kpiIcon}>
                                    <Ionicons name={k.icon as any} size={20} color="rgba(255,255,255,0.9)" />
                                </View>
                                <Text style={styles.kpiValue}>{k.value}</Text>
                                <Text style={styles.kpiLabel}>{k.label}</Text>
                            </LinearGradient>
                        ))}
                    </View>

                    {/* Chart */}
                    <View style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <Text style={styles.chartTitle}>7-Day Revenue</Text>
                            <View style={styles.trendChip}>
                                <Ionicons name="trending-up" size={14} color={Colors.accentGreen} />
                                <Text style={styles.trendText}>+12%</Text>
                            </View>
                        </View>
                        {data?.revenueByDay?.length > 0 ? (
                            <LineChart
                                data={{
                                    labels: data.revenueByDay.map((d: any) => d._id.slice(-5)),
                                    datasets: [{ data: data.revenueByDay.map((d: any) => d.revenue), color: () => Colors.primary, strokeWidth: 3 }],
                                }}
                                width={W - 64}
                                height={200}
                                chartConfig={{
                                    backgroundGradientFrom: 'transparent',
                                    backgroundGradientTo: 'transparent',
                                    color: (opacity = 1) => `rgba(255,107,53,${opacity})`,
                                    labelColor: () => Colors.textMuted,
                                    strokeWidth: 3,
                                    propsForDots: { r: '5', strokeWidth: '2', stroke: Colors.primary, fill: Colors.background },
                                    propsForBackgroundLines: { stroke: Colors.border, strokeDasharray: '' },
                                }}
                                bezier
                                style={styles.chart}
                                withInnerLines
                                withOuterLines={false}
                            />
                        ) : (
                            <View style={styles.noData}>
                                <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
                                <Text style={styles.noDataText}>Not enough data yet</Text>
                            </View>
                        )}
                    </View>

                    {/* Top Items */}
                    <Text style={styles.sectionTitle}>🏆 Top Selling Dishes</Text>
                    {data?.topItems?.length > 0 ? data.topItems.map((item: any, idx: number) => (
                        <View key={idx} style={styles.itemRow}>
                            <LinearGradient
                                colors={idx === 0 ? ['#FFD700', '#F59E0B'] : idx === 1 ? ['#C0C0C0', '#9CA3AF'] : ['#CD7F32', '#A16207']}
                                style={styles.rankBadge}
                            >
                                <Text style={styles.rankText}>{idx + 1}</Text>
                            </LinearGradient>
                            <Text style={styles.itemName} numberOfLines={1}>{item._id}</Text>
                            <View style={styles.soldChip}>
                                <Text style={styles.soldText}>{item.totalQuantity} sold</Text>
                            </View>
                        </View>
                    )) : (
                        <View style={styles.noData}>
                            <Text style={styles.noDataText}>No top items data yet</Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, paddingBottom: 130 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
    title: { ...Typography.h3, color: Colors.textPrimary },
    dateText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    exportBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    periodRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
    periodTab: {
        flex: 1, paddingVertical: 10, borderRadius: Radius.round, overflow: 'hidden',
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    },
    periodActive: { borderColor: 'rgba(255,107,53,0.4)' },
    periodText: { ...Typography.buttonSm, color: Colors.textMuted },
    periodTextActive: { color: Colors.white },
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
    kpiCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
        alignItems: 'center', gap: 6,
    },
    kpiIcon: {
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
    },
    kpiValue: { ...Typography.h4, color: Colors.white, fontWeight: '800' },
    kpiLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.75)' },
    chartCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    chartTitle: { ...Typography.h5, color: Colors.textPrimary },
    trendChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,214,143,0.12)', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(0,214,143,0.3)',
    },
    trendText: { ...Typography.caption, color: Colors.accentGreen, fontWeight: '700' },
    chart: { borderRadius: Radius.md, marginLeft: -16 },
    sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.md },
    itemRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
        marginBottom: 8, borderWidth: 1, borderColor: Colors.border, gap: 12,
    },
    rankBadge: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rankText: { fontSize: 13, fontWeight: '800', color: Colors.white },
    itemName: { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
    soldChip: {
        backgroundColor: 'rgba(255,107,53,0.12)', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)',
    },
    soldText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
    noData: { height: 160, justifyContent: 'center', alignItems: 'center', gap: 10 },
    noDataText: { ...Typography.body2, color: Colors.textMuted },
});
