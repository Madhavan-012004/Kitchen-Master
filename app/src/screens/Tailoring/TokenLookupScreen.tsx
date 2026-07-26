import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    StatusBar, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getJobByToken, getJobsByPhone, updateTailoringStatus } from '../../api/clothing';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

// ── Status pipeline ───────────────────────────────────────────────────────────
const PIPELINE = ['Received', 'In Progress', 'Stitched', 'Delivered'] as const;
type PipelineStep = typeof PIPELINE[number];

const STATUS_COLORS: Record<string, string> = {
    received: '#4C8EFF',
    'in progress': '#F59E0B',
    stitched: '#9B59B6',
    delivered: '#2DD479',
};

function getStepIndex(status: string) {
    const s = status?.toLowerCase?.() || '';
    if (s === 'received') return 0;
    if (s === 'in progress') return 1;
    if (s === 'stitched') return 2;
    if (s === 'delivered') return 3;
    return -1;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function StatusProgress({ status, colors }: { status: string; colors: any }) {
    const currentIndex = getStepIndex(status);

    return (
        <View style={progressStyles.container}>
            {PIPELINE.map((step, idx) => {
                const done = idx <= currentIndex;
                const stepColor = done ? (STATUS_COLORS[step.toLowerCase()] || colors.primary) : colors.border;
                const isLast = idx === PIPELINE.length - 1;

                return (
                    <React.Fragment key={step}>
                        <View style={progressStyles.stepWrap}>
                            <View style={[
                                progressStyles.dot,
                                { backgroundColor: done ? stepColor : colors.glass, borderColor: stepColor },
                            ]}>
                                {done && <Ionicons name="checkmark" size={10} color="#fff" />}
                            </View>
                            <Text style={[progressStyles.stepLabel, { color: done ? stepColor : colors.textMuted }]}>
                                {step}
                            </Text>
                        </View>
                        {!isLast && (
                            <View style={[
                                progressStyles.connector,
                                { backgroundColor: idx < currentIndex ? stepColor : colors.border },
                            ]} />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

const progressStyles = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: Spacing.md },
    stepWrap: { alignItems: 'center', flex: 1 },
    dot: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    stepLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
    connector: { height: 2, flex: 1, marginTop: 10, borderRadius: 1 },
});

// ── Detail Row ────────────────────────────────────────────────────────────────
function DetailRow({ icon, label, value, valueColor, colors }: any) {
    return (
        <View style={detailStyles.row}>
            <View style={[detailStyles.iconWrap, { backgroundColor: colors.glass }]}>
                <Ionicons name={icon} size={16} color={colors.textMuted} />
            </View>
            <View style={detailStyles.content}>
                <Text style={[detailStyles.label, { color: colors.textMuted }]}>{label}</Text>
                <Text style={[detailStyles.value, { color: valueColor || colors.textPrimary }]}>{value || '—'}</Text>
            </View>
        </View>
    );
}

const detailStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
    iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1 },
    label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    value: { ...Typography.body2, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TokenLookupScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    const [searchMode, setSearchMode] = useState<'token' | 'phone'>('token');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        const q = query.trim();
        if (!q) {
            Alert.alert('Enter Search', `Please enter a ${searchMode === 'token' ? 'token number' : 'phone number'}.`);
            return;
        }
        setLoading(true);
        setResult(null);
        setResults([]);
        setError('');

        try {
            if (searchMode === 'token') {
                const res = await getJobByToken(q);
                setResult(res.data.data || null);
            } else {
                const res = await getJobsByPhone(q);
                const data = res.data.data || [];
                if (Array.isArray(data)) {
                    setResults(data);
                    if (data.length === 1) setResult(data[0]);
                } else {
                    setResult(data);
                }
            }
        } catch (e: any) {
            const msg = e.response?.data?.message || 'No job found.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = (job: any) => {
        const statusKey = job.status?.toLowerCase();
        const nextStatus: Record<string, string> = {
            received: 'In Progress',
            'in progress': 'Stitched',
            stitched: 'Delivered',
        };
        const next = nextStatus[statusKey];
        if (!next) return;

        Alert.alert(
            'Update Status',
            `Mark job #${job.token} as "${next}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        try {
                            await updateTailoringStatus(job.id, next);
                            // Refresh same query
                            handleSearch();
                        } catch (e) {
                            Alert.alert('Error', 'Failed to update status.');
                        }
                    },
                },
            ]
        );
    };

    const renderJobCard = (job: any) => {
        const statusColor = STATUS_COLORS[job.status?.toLowerCase()] || colors.textMuted;
        const statusKey = job.status?.toLowerCase();
        const nextStatus: Record<string, string> = {
            received: 'In Progress',
            'in progress': 'Stitched',
            stitched: 'Delivered',
        };
        const hasNextAction = !!nextStatus[statusKey];
        const deliveryDate = job.deliveryDate ? new Date(job.deliveryDate) : null;
        const measurements = job.measurements || {};

        return (
            <View key={job.id} style={[themedStyles.resultCard, { borderColor: colors.border, backgroundColor: colors.card }]}>

                {/* Token + Status */}
                <View style={themedStyles.resultTop}>
                    <View style={themedStyles.tokenRow}>
                        <Ionicons name="pricetag" size={18} color={colors.primary} />
                        <Text style={[themedStyles.tokenText, { color: colors.primary }]}>#{job.token}</Text>
                    </View>
                    <View style={[themedStyles.statusBadge, { backgroundColor: statusColor + '26' }]}>
                        <Text style={[themedStyles.statusBadgeText, { color: statusColor }]}>{job.status}</Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <StatusProgress status={job.status} colors={colors} />

                {/* Divider */}
                <View style={[themedStyles.divider, { backgroundColor: colors.border }]} />

                {/* Details */}
                <DetailRow icon="person-outline" label="Customer" value={job.customerName} colors={colors} />
                <DetailRow icon="call-outline" label="Phone" value={job.customerPhone} colors={colors} />
                <DetailRow
                    icon="calendar-outline"
                    label="Delivery Date"
                    value={deliveryDate
                        ? deliveryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : null}
                    valueColor={deliveryDate && deliveryDate < new Date() && statusKey !== 'delivered'
                        ? colors.error : undefined}
                    colors={colors}
                />
                {job.material && (
                    <DetailRow icon="shirt-outline" label="Material" value={job.material} colors={colors} />
                )}
                {job.totalAmount != null && (
                    <DetailRow
                        icon="cash-outline"
                        label="Total / Advance"
                        value={`₹${job.totalAmount}  •  Advance: ₹${job.advancePaid ?? 0}`}
                        colors={colors}
                    />
                )}

                {/* Measurements */}
                {Object.keys(measurements).length > 0 && (
                    <View style={[themedStyles.measSection, { borderColor: colors.border }]}>
                        <Text style={[themedStyles.measTitle, { color: colors.textMuted }]}>Measurements (in)</Text>
                        <View style={themedStyles.measGrid}>
                            {Object.entries(measurements).map(([k, v]) =>
                                v ? (
                                    <View key={k} style={[themedStyles.measChip, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                        <Text style={[themedStyles.measKey, { color: colors.textMuted }]}>{k}</Text>
                                        <Text style={[themedStyles.measVal, { color: colors.textPrimary }]}>{String(v)}"</Text>
                                    </View>
                                ) : null
                            )}
                        </View>
                    </View>
                )}

                {job.specialNotes && (
                    <View style={[themedStyles.notesBox, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                        <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                        <Text style={[themedStyles.notesText, { color: colors.textSecondary }]}>{job.specialNotes}</Text>
                    </View>
                )}

                {/* Action */}
                {hasNextAction && (
                    <TouchableOpacity
                        style={[themedStyles.actionBtn, Shadows.glow]}
                        onPress={() => handleStatusUpdate(job)}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={gradients.primary} style={themedStyles.actionBtnGrad}>
                            <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.textInverse} />
                            <Text style={[themedStyles.actionBtnText, { color: colors.textInverse }]}>
                                Mark as {nextStatus[statusKey]}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
                {statusKey === 'delivered' && (
                    <View style={[themedStyles.doneBox, { backgroundColor: colors.success + '1A' }]}>
                        <Ionicons name="checkmark-done-circle" size={18} color={colors.success} />
                        <Text style={[themedStyles.doneText, { color: colors.success }]}>Delivered</Text>
                    </View>
                )}
            </View>
        );
    };

    const displayJobs = result ? [result] : results;

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>

                {/* Header */}
                <View style={themedStyles.header}>
                    <TouchableOpacity
                        style={[themedStyles.backBtn, { borderColor: colors.border, backgroundColor: colors.glass }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[themedStyles.headerTitle, { color: colors.textPrimary }]}>Track Job</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Mode Toggle */}
                <View style={themedStyles.modeToggle}>
                    <TouchableOpacity
                        style={[themedStyles.modeBtn, searchMode === 'token' && { backgroundColor: colors.primary }]}
                        onPress={() => { setSearchMode('token'); setQuery(''); setResult(null); setResults([]); setError(''); }}
                    >
                        <Ionicons name="pricetag-outline" size={14} color={searchMode === 'token' ? colors.textInverse : colors.textMuted} />
                        <Text style={[themedStyles.modeBtnText, { color: searchMode === 'token' ? colors.textInverse : colors.textMuted }]}>
                            Token
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[themedStyles.modeBtn, searchMode === 'phone' && { backgroundColor: colors.primary }]}
                        onPress={() => { setSearchMode('phone'); setQuery(''); setResult(null); setResults([]); setError(''); }}
                    >
                        <Ionicons name="call-outline" size={14} color={searchMode === 'phone' ? colors.textInverse : colors.textMuted} />
                        <Text style={[themedStyles.modeBtnText, { color: searchMode === 'phone' ? colors.textInverse : colors.textMuted }]}>
                            Phone
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[themedStyles.searchRow, { borderColor: colors.border, backgroundColor: colors.glass }]}>
                    <Ionicons name={searchMode === 'token' ? 'pricetag-outline' : 'call-outline'} size={18} color={colors.textMuted} />
                    <TextInput
                        style={[themedStyles.searchInput, { color: colors.textPrimary }]}
                        placeholder={searchMode === 'token' ? 'Enter token number...' : 'Enter phone number...'}
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={setQuery}
                        keyboardType={searchMode === 'phone' ? 'phone-pad' : 'default'}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity
                        style={[themedStyles.searchBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator size="small" color={colors.textInverse} />
                            : <Ionicons name="search" size={18} color={colors.textInverse} />
                        }
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={themedStyles.scroll}
                    contentContainerStyle={themedStyles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Error */}
                    {!!error && (
                        <View style={[themedStyles.errorBox, { backgroundColor: colors.error + '1A', borderColor: colors.error }]}>
                            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                            <Text style={[themedStyles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    )}

                    {/* Results */}
                    {displayJobs.map(job => renderJobCard(job))}

                    {/* Multiple results header */}
                    {results.length > 1 && !result && (
                        <Text style={[themedStyles.multiHeader, { color: colors.textMuted }]}>
                            {results.length} jobs found for this phone number
                        </Text>
                    )}

                    {/* Empty State */}
                    {!loading && !error && displayJobs.length === 0 && (
                        <View style={themedStyles.center}>
                            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                            <Text style={[themedStyles.emptyTitle, { color: colors.textMuted }]}>
                                Search for a job
                            </Text>
                            <Text style={[themedStyles.emptySubtitle, { color: colors.textMuted }]}>
                                Enter a token number or customer phone to find tailoring jobs.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    headerTitle: { ...Typography.h4, fontWeight: '900' },
    backBtn: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

    // Mode Toggle
    modeToggle: {
        flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        borderRadius: Radius.round, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.glass, overflow: 'hidden',
    },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, gap: 6, borderRadius: Radius.round,
    },
    modeBtnText: { ...Typography.buttonSm, fontWeight: '800' },

    // Search
    searchRow: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1,
        paddingHorizontal: Spacing.md, gap: 10,
    },
    searchInput: { flex: 1, ...Typography.body1, paddingVertical: Spacing.md },
    searchBtn: {
        width: 38, height: 38, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
    },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 80 },

    // Error
    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.lg,
    },
    errorText: { ...Typography.body2, fontWeight: '700', flex: 1 },

    // Result Card
    resultCard: {
        borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg,
        marginBottom: Spacing.lg, ...Shadows.md,
    },
    resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tokenText: { fontSize: 28, fontWeight: '900', letterSpacing: 1 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
    statusBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
    divider: { height: 1, marginVertical: Spacing.sm },

    // Measurements
    measSection: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
    measTitle: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', marginBottom: Spacing.sm },
    measGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    measChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
    measKey: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    measVal: { ...Typography.body2, fontWeight: '900' },

    // Notes
    notesBox: { flexDirection: 'row', gap: 8, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.md },
    notesText: { ...Typography.body2, flex: 1 },

    // Actions
    actionBtn: { marginTop: Spacing.lg, borderRadius: Radius.xl, overflow: 'hidden' },
    actionBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
    actionBtnText: { ...Typography.button, fontWeight: '900' },
    doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: Radius.lg, marginTop: Spacing.md },
    doneText: { ...Typography.button, fontWeight: '900' },

    multiHeader: { ...Typography.caption, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },

    center: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: Spacing.xxl },
    emptyTitle: { ...Typography.h4 },
    emptySubtitle: { ...Typography.body2, textAlign: 'center' },
});
