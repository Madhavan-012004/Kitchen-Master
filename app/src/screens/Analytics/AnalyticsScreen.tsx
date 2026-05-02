import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    Dimensions, ActivityIndicator, TouchableOpacity, StatusBar, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { getApiBaseUrl } from '../../config/api';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { analyticsAPI } from '../../api/analytics';
import { useAuthStore } from '../../store/useAuthStore';
import { useStakeholderStore } from '../../store/useStakeholderStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const W = Dimensions.get('window').width;

const PERIODS = ['Today', 'Week', 'Month'] as const;
type Period = typeof PERIODS[number];

export default function AnalyticsScreen() {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const { user } = useAuthStore();
    const { accessibleRestaurants, selectedRestaurantId, setSelectedRestaurantId } = useStakeholderStore();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('Today');
    const [isDownloading, setIsDownloading] = useState(false);
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
    const [selectedReportType, setSelectedReportType] = useState('end-day-report');
    const [selectedReportFormat, setSelectedReportFormat] = useState('pdf');

    const executeDownload = async () => {
        try {
            setIsDownloading(true);
            setIsReportModalVisible(false);
            const token = useAuthStore.getState().token;
            let baseUrl = await getApiBaseUrl();
            if (baseUrl.endsWith('/api')) {
                baseUrl = baseUrl.slice(0, -4);
            }
            
            let url = `${baseUrl}/api/analytics/download-report?type=${selectedReportType}&format=${selectedReportFormat}`;
            
            const ext = selectedReportFormat === 'word' ? 'docx' : selectedReportFormat;
            const fileUri = FileSystem.documentDirectory + `${selectedReportType}-${new Date().toISOString().split('T')[0]}.${ext}`;
            
            const headers: any = { Authorization: `Bearer ${token}` };
            if (selectedRestaurantId) {
                headers['X-Restaurant-Id'] = String(selectedRestaurantId);
            } else if (user?.role === 'stakeholder') {
                headers['X-Restaurant-Id'] = 'ALL';
            }

            const { uri, status } = await FileSystem.downloadAsync(url, fileUri, { headers });
            
            if (status === 200) {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { UTI: `.${ext}` });
                } else {
                    Alert.alert('Success', 'Report saved to ' + uri);
                }
            } else {
                Alert.alert('Error', 'Failed to generate report. Status: ' + status);
            }
        } catch(err) {
            console.error(err);
            Alert.alert('Error', 'An error occurred while downloading the report.');
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
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
    }, [period, selectedRestaurantId]); // Refetch if restaurant scope changes

    if (loading) return (
        <LinearGradient colors={gradients.background} style={themedStyles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
        </LinearGradient>
    );

    const summary = data?.summary || {};
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    const kpis = [
        { label: 'Revenue', value: `₹${summary.totalRevenue || 0}`, icon: 'cash-outline', grad: gradients.primary, shadow: Shadows.primary },
        { label: 'Net Profit', value: `₹${Math.round(summary.netProfit || 0)}`, icon: 'wallet-outline', grad: [colors.success || '#00D68F', colors.success || '#00B377'], shadow: Shadows.md },
        { label: 'Expenses', value: `₹${Math.round(summary.totalExpense || 0)}`, icon: 'receipt-outline', grad: ['#C6F53D', '#E74C3C'], shadow: Shadows.md },
    ];

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={themedStyles.scroll}>
                    {/* Header */}
                    <View style={themedStyles.header}>
                        <View>
                            <Text style={themedStyles.title}>Analytics</Text>
                            <Text style={themedStyles.dateText}>{today}</Text>
                        </View>
                        <TouchableOpacity style={themedStyles.exportBtn} onPress={() => setIsReportModalVisible(true)} disabled={isDownloading}>
                            {isDownloading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Stakeholder Restaurant Switcher */}
                    {user?.role === 'stakeholder' && accessibleRestaurants?.length > 0 && (
                        <View style={{ marginBottom: Spacing.xl }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                <TouchableOpacity 
                                    style={[themedStyles.periodTab, selectedRestaurantId === null && themedStyles.periodActive, { paddingHorizontal: 16 }]}
                                    onPress={() => setSelectedRestaurantId(null)}
                                >
                                    {selectedRestaurantId === null && <LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />}
                                    <Text style={[themedStyles.periodText, selectedRestaurantId === null && themedStyles.periodTextActive]}>All Restaurants</Text>
                                </TouchableOpacity>
                                {accessibleRestaurants.map(r => (
                                    <TouchableOpacity 
                                        key={r.restaurantId}
                                        style={[themedStyles.periodTab, selectedRestaurantId === r.restaurantId && themedStyles.periodActive, { paddingHorizontal: 16 }]}
                                        onPress={() => setSelectedRestaurantId(r.restaurantId)}
                                    >
                                        {selectedRestaurantId === r.restaurantId && <LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />}
                                        <Text style={[themedStyles.periodText, selectedRestaurantId === r.restaurantId && themedStyles.periodTextActive]}>{r.restaurantName}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Period Selector */}
                    <View style={themedStyles.periodRow}>
                        {PERIODS.map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[themedStyles.periodTab, period === p && themedStyles.periodActive]}
                                onPress={() => setPeriod(p)}
                            >
                                {period === p && (
                                    <LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />
                                )}
                                <Text style={[themedStyles.periodText, period === p && themedStyles.periodTextActive]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* KPI Cards */}
                    <View style={themedStyles.kpiRow}>
                        {kpis.map((k, i) => (
                            <LinearGradient key={i} colors={k.grad as [string, string]} style={[themedStyles.kpiCard, k.shadow]}>
                                <View style={themedStyles.kpiIcon}>
                                    <Ionicons name={k.icon as any} size={20} color={colors.white} />
                                </View>
                                <Text style={themedStyles.kpiValue}>{k.value}</Text>
                                <Text style={themedStyles.kpiLabel}>{k.label}</Text>
                            </LinearGradient>
                        ))}
                    </View>

                    {/* Chart */}
                    <View style={themedStyles.chartCard}>
                        <View style={themedStyles.chartHeader}>
                            <Text style={themedStyles.chartTitle}>7-Day Revenue</Text>
                            <View style={themedStyles.trendChip}>
                                <Ionicons name="trending-up" size={14} color={colors.success || '#00D68F'} />
                                <Text style={themedStyles.trendText}>+12%</Text>
                            </View>
                        </View>
                        {data?.revenueByDay?.length > 0 ? (
                            <LineChart
                                data={{
                                    labels: data.revenueByDay.map((d: any) => {
                                        if (d?._id && typeof d._id === 'string') {
                                            return d._id.includes('-') ? d._id.slice(-5) : d._id;
                                        }
                                        return String(d?._id || 'N/A');
                                    }),
                                    datasets: [
                                        { 
                                            data: data.revenueByDay.map((d: any) => d.revenue), 
                                            color: () => colors.primary, 
                                            strokeWidth: 3 
                                        },
                                        { 
                                            data: data.revenueByDay.map((d: any) => d.profit || 0), 
                                            color: () => '#00D68F', 
                                            strokeWidth: 2 
                                        }
                                    ],
                                    legend: ["Revenue", "Net Profit"]
                                }}
                                width={W - 44}
                                height={200}
                                chartConfig={{
                                    backgroundGradientFrom: colors.card,
                                    backgroundGradientTo: colors.card,
                                    color: (opacity = 1) => isDark ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`,
                                    labelColor: () => colors.textMuted,
                                    strokeWidth: 3,
                                    propsForDots: { r: '5', strokeWidth: '2', stroke: colors.primary, fill: colors.card },
                                    propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '' },
                                }}
                                bezier={data.revenueByDay.length > 2}
                                style={themedStyles.chart}
                                withInnerLines
                                withOuterLines={false}
                            />
                        ) : (
                            <View style={themedStyles.noData}>
                                <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
                                <Text style={themedStyles.noDataText}>Not enough data yet</Text>
                            </View>
                        )}
                    </View>

                    {/* Expenditure Breakdown */}
                    <View style={themedStyles.chartCard}>
                        <Text style={themedStyles.chartTitle}>💸 Expenditure Breakdown</Text>
                        {data?.expenseBreakdown?.length > 0 ? (
                            <View style={{ alignItems: 'center', marginTop: 10 }}>
                                <BarChart
                                    data={{
                                        labels: data.expenseBreakdown.map((e: any) => e.name),
                                        datasets: [{ data: data.expenseBreakdown.map((e: any) => e.value) }]
                                    }}
                                    width={W - 64}
                                    height={200}
                                    yAxisLabel="₹"
                                    yAxisSuffix=""
                                    chartConfig={{
                                        backgroundGradientFrom: colors.card,
                                        backgroundGradientTo: colors.card,
                                        color: (opacity = 1) => colors.primary,
                                        labelColor: () => colors.textMuted,
                                        barPercentage: 0.6,
                                        propsForBackgroundLines: { strokeOpacity: 0.1 }
                                    }}
                                    style={{ borderRadius: 16, marginVertical: 8 }}
                                    fromZero
                                    showValuesOnTopOfBars
                                />
                                <View style={themedStyles.legendContainer}>
                                    {data.expenseBreakdown.map((e: any, i: number) => (
                                        <View key={i} style={themedStyles.legendItem}>
                                            <View style={[themedStyles.legendDot, { backgroundColor: ['#C6F53D', '#4C8EFF', '#00D68F', '#9D50BB', '#E74C3C'][i % 5] }]} />
                                            <Text style={themedStyles.legendText}>{e.name}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <Text style={themedStyles.noDataText}>No expenditure data</Text>
                        )}
                    </View>

                    {/* Top Items */}
                    <Text style={themedStyles.sectionTitle}>🏆 Top Selling Dishes</Text>
                    {data?.topItems?.length > 0 ? data.topItems.map((item: any, idx: number) => (
                        <View key={idx} style={themedStyles.itemRow}>
                            <LinearGradient
                                colors={idx === 0 ? ['#FFD700', '#F59E0B'] : idx === 1 ? ['#C0C0C0', '#9CA3AF'] : ['#CD7F32', '#A16207']}
                                style={themedStyles.rankBadge}
                            >
                                <Text style={themedStyles.rankText}>{idx + 1}</Text>
                            </LinearGradient>
                            <Text style={themedStyles.itemName} numberOfLines={1}>{item._id}</Text>
                            <View style={themedStyles.soldChip}>
                                <Text style={themedStyles.soldText}>{item.totalQuantity} sold</Text>
                            </View>
                        </View>
                    )) : (
                        <View style={themedStyles.noData}>
                            <Text style={themedStyles.noDataText}>No top items data yet</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Report Configuration Modal */}
                <Modal visible={isReportModalVisible} transparent animationType="fade" onRequestClose={() => setIsReportModalVisible(false)}>
                    <View style={themedStyles.modalOverlay}>
                        <View style={themedStyles.modalContent}>
                            <View style={themedStyles.modalHeader}>
                                <Text style={themedStyles.modalTitle}>Generate Report</Text>
                                <TouchableOpacity onPress={() => setIsReportModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <Text style={themedStyles.modalSectionTitle}>Report Type</Text>
                            <View style={themedStyles.optionsGrid}>
                                {[
                                    { id: 'end-day-report', label: 'End of Day Report', icon: 'today-outline' },
                                    { id: 'gst-ledger-report', label: 'GST Ledger Report', icon: 'document-text-outline' }
                                ].map((type) => (
                                    <TouchableOpacity 
                                        key={type.id} 
                                        style={[themedStyles.optionCard, selectedReportType === type.id && themedStyles.optionCardActive]}
                                        onPress={() => setSelectedReportType(type.id)}
                                    >
                                        <Ionicons name={type.icon as any} size={24} color={selectedReportType === type.id ? colors.primary : colors.textSecondary} />
                                        <Text style={[themedStyles.optionText, selectedReportType === type.id && themedStyles.optionTextActive]}>{type.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={themedStyles.modalSectionTitle}>Format</Text>
                            <View style={themedStyles.optionsGrid}>
                                {[
                                    { id: 'pdf', label: 'PDF Document', icon: 'document-outline' },
                                    { id: 'word', label: 'Word (.docx)', icon: 'document-text' }
                                ].map((format) => (
                                    <TouchableOpacity 
                                        key={format.id} 
                                        style={[themedStyles.optionCard, selectedReportFormat === format.id && themedStyles.optionCardActive]}
                                        onPress={() => setSelectedReportFormat(format.id)}
                                    >
                                        <Ionicons name={format.icon as any} size={24} color={selectedReportFormat === format.id ? colors.primary : colors.textSecondary} />
                                        <Text style={[themedStyles.optionText, selectedReportFormat === format.id && themedStyles.optionTextActive]}>{format.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={themedStyles.downloadBtn} onPress={executeDownload}>
                                <Ionicons name="download-outline" size={20} color={colors.white} />
                                <Text style={themedStyles.downloadBtnText}>Generate & Download</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, paddingBottom: 130 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
    title: { ...Typography.h3, color: colors.textPrimary },
    dateText: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
    exportBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    periodRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
    periodTab: {
        flex: 1, paddingVertical: 10, borderRadius: Radius.round, overflow: 'hidden',
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    periodActive: { borderColor: colors.primary + '66' },
    periodText: { ...Typography.buttonSm, color: colors.textMuted },
    periodTextActive: { color: colors.white },
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
    kpiCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
        alignItems: 'center', gap: 6,
    },
    kpiIcon: {
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
    },
    kpiValue: { ...Typography.h4, color: colors.white, fontWeight: '800' },
    kpiLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },
    chartCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        marginBottom: Spacing.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    chartTitle: { ...Typography.h5, color: colors.textPrimary },
    trendChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: (colors.success || '#00D68F') + '1A', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.success || '#00D68F') + '33',
    },
    trendText: { ...Typography.caption, color: colors.success || '#00D68F', fontWeight: '700' },
    chart: { borderRadius: Radius.md, marginLeft: -16 },
    sectionTitle: { ...Typography.h4, color: colors.textPrimary, marginBottom: Spacing.md },
    itemRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card, borderRadius: Radius.md, padding: Spacing.md,
        marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    rankBadge: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rankText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
    itemName: { ...Typography.body1, color: colors.textPrimary, flex: 1 },
    soldChip: {
        backgroundColor: (colors.primary || '#C6F53D') + '1A', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.primary || '#C6F53D') + '33',
    },
    soldText: { ...Typography.caption, color: colors.primary, fontWeight: '700' },
    noData: { height: 160, justifyContent: 'center', alignItems: 'center', gap: 10 },
    noDataText: { ...Typography.body2, color: colors.textMuted },
    legendContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { ...Typography.caption, color: colors.textSecondary },
    profitAnalysis: { gap: 12 },
    profitValueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bigProfit: { ...Typography.h2, color: colors.textPrimary, fontWeight: '900' },
    profitIndicator: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
    
    // Modal Styles
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg
    },
    modalContent: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg, width: '100%',
        ...Shadows.lg
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md
    },
    modalTitle: { ...Typography.h3, color: colors.textPrimary },
    modalSectionTitle: { ...Typography.subtitle2, color: colors.textSecondary, marginBottom: 8, marginTop: 12 },
    optionsGrid: {
        flexDirection: 'row', gap: 12, marginBottom: Spacing.sm
    },
    optionCard: {
        flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', backgroundColor: colors.background
    },
    optionCardActive: {
        borderColor: colors.primary, backgroundColor: colors.primary + '1A'
    },
    optionText: { ...Typography.body2, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
    optionTextActive: { color: colors.primary, fontWeight: '700' },
    downloadBtn: {
        backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, borderRadius: Radius.md, marginTop: Spacing.xl, gap: 8
    },
    downloadBtnText: { ...Typography.subtitle1, color: colors.white, fontWeight: '700' }
});
