import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, TextInput, Modal, Alert,
    ScrollView, LayoutAnimation, Platform, UIManager,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAppTheme } from '../../theme';

export default function PoultryHistoryScreen() {
    const navigation = useNavigation<any>();
    const { colors, isDark } = useAppTheme();

    const todayStr = new Date().toISOString().split('T')[0];
    const sevenAgoStr = new Date(Date.now() - 7 * 86400 * 1000).toISOString().split('T')[0];

    const [bills, setBills] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [from, setFrom] = useState(sevenAgoStr);
    const [to, setTo] = useState(todayStr);
    const [clientId, setClientId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [expandedBill, setExpandedBill] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const fetchClients = async () => {
        try {
            const raw = await AsyncStorage.getItem('poultry_clients');
            if (raw) setClients(JSON.parse(raw));
        } catch (e) {
            console.warn('Failed to fetch offline clients', e);
        }
        try {
            const res = await apiClient.get('/poultry/clients?activeOnly=false');
            if (res.data?.success) {
                setClients(res.data.data || []);
                await AsyncStorage.setItem('poultry_clients', JSON.stringify(res.data.data || []));
            }
        } catch { } // Silent fallback
    };

    const fetchBills = useCallback(async () => {
        setLoading(true);
        try {
            let fetchedBills: any[] = [];

            // 1. Fetch remote orders from standard POS fallback
            try {
                const res = await apiClient.get('/orders/history');
                let genericBills = [];
                if (res.data?.data?.orders && Array.isArray(res.data.data.orders)) {
                    genericBills = res.data.data.orders;
                } else if (res.data?.data && Array.isArray(res.data.data)) {
                    genericBills = res.data.data;
                }

                // Filter and reconstruct
                const remotePoultry = genericBills.filter((b: any) => b.source === 'poultry' || (b.notes && b.notes.includes('||CLIENTID:')) || (b.notes && b.notes.includes('||BILLNO:')));

                remotePoultry.forEach((b: any) => {
                    let clientId = null;
                    let parsedBillNo = b.billNumber || b.orderNumber || b._id || b.id;
                    if (b.notes) {
                        try {
                            const cMatch = b.notes.match(/\|\|CLIENTID:([^|]+)\|\|/);
                            if (cMatch && cMatch[1]) clientId = cMatch[1];
                            const bMatch = b.notes.match(/\|\|BILLNO:([^|]+)\|\|/);
                            if (bMatch && bMatch[1]) parsedBillNo = bMatch[1];
                        } catch (e) { }
                    }
                    fetchedBills.push({
                        ...b,
                        id: parsedBillNo,
                        _id: parsedBillNo,
                        billNumber: parsedBillNo,
                        orderNumber: parsedBillNo,
                        client: clientId ? { id: clientId } : null,
                        grandTotal: b.totalAmount || b.grandTotal || b.total || 0,
                    });
                });
            } catch (e) {
                console.warn('Failed remote /orders sync', e);
            }

            // 2. Merge with offline Cache
            try {
                const rawLocal = await AsyncStorage.getItem('poultry_history_bills');
                if (rawLocal) {
                    const localBills = JSON.parse(rawLocal);
                    localBills.forEach((offlineBill: any) => {
                        const existsIndex = fetchedBills.findIndex(b => (b.id || b._id) === (offlineBill.id || offlineBill._id));
                        if (existsIndex >= 0) {
                            fetchedBills[existsIndex] = { ...fetchedBills[existsIndex], ...offlineBill, _synced: true };
                        } else {
                            fetchedBills.push(offlineBill);
                        }
                    });
                }
            } catch (e) { }

            // Sort by latest
            fetchedBills.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Apply JS-side overriding of Paid status
            const rawOverrides = await AsyncStorage.getItem('poultry_paid_bills');
            const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
            fetchedBills = fetchedBills.map((b: any) => {
                const id = b._id || b.id;
                if (overrides[id]) {
                    return { ...b, paymentMethod: 'CASH', status: 'PAID', _overridden: true };
                }
                return b;
            });

            // Apply JS-side caching
            await AsyncStorage.setItem('poultry_history_bills', JSON.stringify(fetchedBills));

            // Filtering in JS
            const fromTime = new Date(from + 'T00:00:00').getTime();
            const toTime = new Date(to + 'T23:59:59').getTime();

            fetchedBills = fetchedBills.filter((b: any) => {
                const bTime = new Date(b.createdAt).getTime();
                if (bTime < fromTime || bTime > toTime) return false;
                if (clientId && b.client?.id !== clientId && b.client?._id !== clientId) return false;
                if (statusFilter && b.paymentMethod !== statusFilter && b.status !== statusFilter) return false;
                return true;
            });

            setBills(fetchedBills);
        } catch (e) {
            // Offline fallback
            try {
                const local = await AsyncStorage.getItem('poultry_history_bills');
                if (local) {
                    let localBills = JSON.parse(local);

                    const fromTime = new Date(from + 'T00:00:00').getTime();
                    const toTime = new Date(to + 'T23:59:59').getTime();

                    localBills = localBills.filter((b: any) => {
                        const bTime = new Date(b.createdAt).getTime();
                        if (bTime < fromTime || bTime > toTime) return false;
                        if (clientId && b.client?.id !== clientId && b.client?._id !== clientId) return false;
                        if (statusFilter && b.paymentMethod !== statusFilter && b.status !== statusFilter) return false;
                        return true;
                    });

                    setBills(localBills);
                } else {
                    setBills([]);
                }
            } catch (err) {
                setBills([]);
            }
        } finally {
            setLoading(false);
        }
    }, [from, to, clientId, statusFilter]);

    useFocusEffect(
        useCallback(() => {
            fetchClients();
            fetchBills();
        }, [fetchBills])
    );

    const togglePaid = async (bill: any) => {
        const id = bill._id || bill.id;
        if (!id) return;

        try {
            const rawOverrides = await AsyncStorage.getItem('poultry_paid_bills');
            let overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
            const isCurrentlyPaid = !!overrides[id];

            // Toggle state in local storage
            if (isCurrentlyPaid) {
                delete overrides[id];
            } else {
                overrides[id] = true;
            }

            const clientId = bill.client?.id || bill.client?._id;
            if (clientId) {
                try {
                    const cRes = await apiClient.get(`/customers/${clientId}`);
                    const cData = cRes.data?.data || cRes.data;
                    let meta: any = {};
                    if (cData.email && cData.email.startsWith('||META:')) {
                        try { meta = JSON.parse(cData.email.replace('||META:', '')); } catch (e) { }
                    }
                    const billTotal = bill.grandTotal || bill.total || 0;

                    if (isCurrentlyPaid) {
                        meta.pendingAmount = (meta.pendingAmount || 0) + billTotal;
                    } else {
                        meta.pendingAmount = Math.max(0, (meta.pendingAmount || 0) - billTotal);
                    }

                    await apiClient.post(`/customers`, {
                        name: cData.name,
                        phone: cData.phone,
                        email: '||META:' + JSON.stringify(meta)
                    });
                } catch (err) { console.warn('Failed to update meta on backend', err); }

                // Always update local cache aggressively
                try {
                    const rawClients = await AsyncStorage.getItem('poultry_clients');
                    if (rawClients) {
                        const localClients = JSON.parse(rawClients);
                        const idx = localClients.findIndex((c: any) => c.id === clientId || c._id === clientId);
                        if (idx >= 0) {
                            const billTotal = bill.grandTotal || bill.total || 0;
                            if (isCurrentlyPaid) {
                                localClients[idx].pendingAmount = (localClients[idx].pendingAmount || 0) + billTotal;
                            } else {
                                localClients[idx].pendingAmount = Math.max(0, (localClients[idx].pendingAmount || 0) - billTotal);
                            }
                            await AsyncStorage.setItem('poultry_clients', JSON.stringify(localClients));
                        }
                    }
                } catch (e) { console.warn('Failed local cache update', e); }
            }

            await AsyncStorage.setItem('poultry_paid_bills', JSON.stringify(overrides));
            setBills(prev => prev.map(b => {
                if ((b._id || b.id) === id) {
                    return isCurrentlyPaid
                        ? { ...b, paymentMethod: 'CREDIT', status: 'PENDING', _overridden: false }
                        : { ...b, paymentMethod: 'CASH', status: 'PAID', _overridden: true };
                }
                return b;
            }));
        } catch (e) {
            console.warn('Failed to mark paid', e);
        }
    };

    const deleteBill = (bill: any) => {
        const id = bill._id || bill.id;
        if (!id) return;

        Alert.alert('Delete Bill', `Are you sure you want to delete bill #${bill.billNumber || String(id).slice(-6)}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        try { await apiClient.delete(`/orders/${id}`); } catch (e) { }

                        const rawLocal = await AsyncStorage.getItem('poultry_history_bills');
                        if (rawLocal) {
                            let localBills = JSON.parse(rawLocal);
                            localBills = localBills.filter((b: any) => (b.id || b._id) !== id);
                            await AsyncStorage.setItem('poultry_history_bills', JSON.stringify(localBills));
                        }

                        // Remove paid override if any
                        const rawOverrides = await AsyncStorage.getItem('poultry_paid_bills');
                        if (rawOverrides) {
                            let overrides = JSON.parse(rawOverrides);
                            if (overrides[id]) {
                                delete overrides[id];
                                await AsyncStorage.setItem('poultry_paid_bills', JSON.stringify(overrides));
                            }
                        }

                        setBills(prev => prev.filter(b => (b.id || b._id) !== id));
                        if (expandedBill === id) setExpandedBill(null);
                    } catch (e) {
                        console.warn('Failed to delete', e);
                    }
                }
            }
        ]);
    };

    // Summary calculations
    const totalRevenue = bills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
    const totalPending = bills.reduce((s, b) => s + (b.paymentMethod === 'CREDIT' || b.status === 'PENDING' ? (b.grandTotal || b.total || 0) : 0), 0);
    const billCount = bills.length;
    const totalCollected = totalRevenue - totalPending;

    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

    const getStatusStyle = (b: any) => {
        const pm = (b.paymentMethod || '').toUpperCase();
        if (pm === 'CREDIT' || b.status === 'PENDING') return { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' };
        if (pm === 'CASH') return { bg: 'rgba(52,211,153,0.15)', text: '#34d399' };
        if (pm === 'UPI') return { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' };
        if (pm === 'CARD') return { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa' };
        return { bg: 'rgba(255,255,255,0.1)', text: colors.textMuted };
    };

    const s = styles(colors, isDark);

    const renderBill = ({ item }: { item: any }) => {
        const isExpanded = expandedBill === (item._id || item.id);
        const st = getStatusStyle(item);
        const clientName = item.clientName || item.client?.name || 'Walk-in';
        const initial = clientName.charAt(0).toUpperCase();

        const toggleExpand = () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedBill(isExpanded ? null : (item._id || item.id));
        };

        return (
            <TouchableOpacity style={s.cardWrapper} onPress={toggleExpand} activeOpacity={0.9}>
                <LinearGradient colors={isDark ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']} style={[s.card, isExpanded && s.cardExpanded]}>
                    <View style={s.cardBody}>
                        <View style={s.avatarContainer}>
                            <LinearGradient colors={['#a3e635', '#65a30d']} style={s.avatar}>
                                <Text style={s.avatarText}>{initial}</Text>
                            </LinearGradient>
                        </View>
                        <View style={{ flex: 1, paddingRight: 10, justifyContent: 'center' }}>
                            <Text style={s.clientName} numberOfLines={1}>{clientName}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                                <Text style={s.dateText}> {fmtDate(item.createdAt || item.date)} • #{item.billNumber || String(item._id || item.id).slice(-6)}</Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                            <Text style={s.totalAmt}>₹{(item.grandTotal || item.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                            <View style={[s.badge, { backgroundColor: st.bg }]}>
                                <Text style={[s.badgeText, { color: st.text }]}>{item.paymentMethod || 'CASH'}</Text>
                            </View>
                            <View style={[s.badge, { backgroundColor: item.status === 'PAID' || item.paymentMethod !== 'CREDIT' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)', marginTop: 4 }]}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (item.paymentMethod === 'CREDIT' && item.status !== 'PAID') {
                                            togglePaid(item);
                                        }
                                    }}
                                    disabled={item.status === 'PAID' || item.paymentMethod !== 'CREDIT'}
                                >
                                    <Text style={[s.badgeText, { color: item.status === 'PAID' || item.paymentMethod !== 'CREDIT' ? '#34d399' : '#fbbf24' }]}>
                                        {item.status === 'PAID' || item.paymentMethod !== 'CREDIT' ? 'PAID' : 'UNPAID ▼'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {!isExpanded && (
                                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 6, fontWeight: '700' }}>TAP TO VIEW ⬇</Text>
                            )}
                        </View>
                    </View>

                    {isExpanded && (
                        <View style={s.expandedPanel}>
                            <View style={s.expandedHeader}>
                                <Text style={s.th}>ITEM</Text>
                                <Text style={[s.th, { textAlign: 'center' }]}>RATE</Text>
                                <Text style={[s.th, { textAlign: 'center' }]}>QTY</Text>
                                <Text style={[s.th, { textAlign: 'right' }]}>AMT</Text>
                            </View>
                            {(item.items || []).map((line: any, idx: number) => (
                                <View key={idx} style={s.expandedRow}>
                                    <Text style={s.td} numberOfLines={1}>{line.name || line.itemName}</Text>
                                    <Text style={[s.td, { textAlign: 'center', color: colors.textSecondary }]}>₹{line.rate || line.sellingPrice || 0}</Text>
                                    <Text style={[s.td, { textAlign: 'center', color: colors.textSecondary }]}>{line.weight > 0 ? `${line.weight}kg` : `${line.qty || line.quantity || 0}p`}</Text>
                                    <Text style={[s.td, { textAlign: 'right', color: colors.textPrimary, fontWeight: '800' }]}>
                                        ₹{(line.amount || line.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            ))}
                            {(item.paymentMethod === 'CREDIT' || item.status === 'PENDING') && !item._overridden && (
                                <View style={{ marginTop: 16, alignItems: 'flex-end', width: '100%' }}>
                                    <TouchableOpacity
                                        onPress={() => togglePaid(item)}
                                        style={[s.payBtn, { backgroundColor: item.paymentMethod === 'CREDIT' ? '#34d399' : '#fbbf24', width: '100%', marginBottom: 12 }]}
                                    >
                                        <Ionicons name={item.paymentMethod === 'CREDIT' ? "checkmark-circle" : "arrow-undo"} size={16} color="#fff" />
                                        <Text style={s.payBtnText}>
                                            {item.paymentMethod === 'CREDIT' ? 'MARK AS PAID' : 'REVERT TO PENDING'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View style={{ marginTop: item.paymentMethod === 'CREDIT' ? 0 : 16, width: '100%' }}>
                                <TouchableOpacity
                                    onPress={() => deleteBill(item)}
                                    style={[s.payBtn, { backgroundColor: '#fee2e2', width: '100%' }]}
                                >
                                    <Ionicons name="trash" size={16} color="#ef4444" />
                                    <Text style={[s.payBtnText, { color: '#ef4444' }]}>DELETE BILL</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {/* Premium Dark Hero Header */}
            <LinearGradient colors={['#0f172a', '#1e293b']} style={s.heroHeader}>
                <SafeAreaView edges={['top']}>
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={s.heroTitle}>Poultry Ledger</Text>
                        <TouchableOpacity style={s.filterBtnIcon} onPress={() => setShowFilters(true)}>
                            <Ionicons name="filter" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={s.heroStatsCard}>
                        <View style={s.metricQuadrant}>
                            <View>
                                <Ionicons name="cash" size={20} color="#a3e635" style={{ marginBottom: 4 }} />
                                <Text style={s.metricLabel}>TOTAL SALES</Text>
                                <Text style={[s.metricValue, { color: '#a3e635' }]}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={s.metricDivider} />
                            <View>
                                <Ionicons name="hourglass" size={20} color="#fbbf24" style={{ marginBottom: 4 }} />
                                <Text style={s.metricLabel}>PENDING</Text>
                                <Text style={[s.metricValue, { color: '#fbbf24' }]}>₹{totalPending.toLocaleString('en-IN')}</Text>
                            </View>
                        </View>

                        <View style={[s.metricQuadrant, { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 }]}>
                            <View>
                                <Ionicons name="receipt" size={20} color="#60a5fa" style={{ marginBottom: 4 }} />
                                <Text style={s.metricLabel}>BILLS COUNT</Text>
                                <Text style={[s.metricValue, { color: '#60a5fa' }]}>{billCount}</Text>
                            </View>
                            <View style={s.metricDivider} />
                            <View>
                                <Ionicons name="checkmark-circle" size={20} color="#34d399" style={{ marginBottom: 4 }} />
                                <Text style={s.metricLabel}>COLLECTED</Text>
                                <Text style={[s.metricValue, { color: '#34d399' }]}>₹{totalCollected.toLocaleString('en-IN')}</Text>
                            </View>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {loading ? (
                <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
            ) : (
                <FlatList
                    data={bills}
                    keyExtractor={(item, i) => String(item._id || item.id || i)}
                    renderItem={renderBill}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <View style={s.emptyCircle}>
                                <Ionicons name="document-text" size={48} color={isDark ? '#334155' : '#cbd5e1'} />
                            </View>
                            <Text style={s.emptyText}>No bills found</Text>
                            <Text style={s.emptySubText}>Try adjusting your filters to find what you're looking for.</Text>
                        </View>
                    }
                />
            )}

            {/* Filters Modal */}
            <Modal visible={showFilters} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHandle} />
                        <Text style={s.modalTitle}>Filter Bills</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={s.filterRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.label}>From Date</Text>
                                    <TextInput style={s.input} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.label}>To Date</Text>
                                    <TextInput style={s.input} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                                </View>
                            </View>

                            <Text style={s.label}>Client</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                <TouchableOpacity
                                    style={[s.chip, clientId === '' && s.chipActive]}
                                    onPress={() => setClientId('')}
                                ><Text style={[s.chipText, clientId === '' && s.chipTextActive]}>All</Text></TouchableOpacity>
                                {clients.map(c => (
                                    <TouchableOpacity
                                        key={c._id || c.id}
                                        style={[s.chip, clientId === (c._id || c.id) && s.chipActive]}
                                        onPress={() => setClientId(c._id || c.id)}
                                    >
                                        <Text style={[s.chipText, clientId === (c._id || c.id) && s.chipTextActive]}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={s.label}>Payment Status</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {['', 'CASH', 'UPI', 'CARD', 'CREDIT'].map(sVal => (
                                    <TouchableOpacity
                                        key={sVal}
                                        style={[s.chip, statusFilter === sVal && s.chipActive]}
                                        onPress={() => setStatusFilter(sVal)}
                                    >
                                        <Text style={[s.chipText, statusFilter === sVal && s.chipTextActive]}>{sVal || 'All'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={s.applyBtn} onPress={() => { setShowFilters(false); fetchBills(); }}>
                            <Text style={s.applyBtnText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const { width } = Dimensions.get('window');
const styles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Modern Hero Header
    heroHeader: { paddingBottom: 50, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    heroTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    filterBtnIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    heroStatsCard: { backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 20, marginTop: 10, marginBottom: 25, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    metricQuadrant: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.1)' },
    metricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
    metricValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    cardWrapper: { marginHorizontal: 20, marginBottom: 16 },
    card: { borderRadius: 24, padding: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' },
    cardExpanded: { borderColor: colors.accent, elevation: 8, shadowOpacity: 0.15 },
    cardBody: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingRight: 16 },
    avatarContainer: { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
    avatar: { width: 50, height: 50, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    avatarText: { fontSize: 20, fontWeight: '900', color: '#fff' },
    clientName: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 2 },
    dateText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    totalAmt: { color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Expansion Area
    expandedPanel: { marginHorizontal: 12, marginBottom: 12, marginTop: 4, padding: 16, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 16 },
    expandedHeader: { flexDirection: 'row', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
    th: { flex: 1, fontSize: 10, color: colors.textMuted, fontWeight: '900', letterSpacing: 1 },
    expandedRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
    td: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600' },

    // Empty state
    empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyText: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8 },
    emptySubText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

    // Filters Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40, maxHeight: '85%', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20 },
    modalHandle: { width: 44, height: 6, backgroundColor: colors.textMuted, borderRadius: 6, alignSelf: 'center', marginBottom: 24, opacity: 0.3 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 24, letterSpacing: -0.5 },
    label: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
    input: { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 16, padding: 16, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', marginBottom: 24, fontWeight: '600' },
    filterRow: { flexDirection: 'row' },
    chip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', marginRight: 10, marginBottom: 10 },
    chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    chipTextActive: { color: colors.background, fontWeight: '900' },
    applyBtn: { backgroundColor: '#a3e635', borderRadius: 20, padding: 20, alignItems: 'center', marginTop: 32, shadowColor: '#a3e635', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
    applyBtnText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
    payBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        gap: 8,
    },
    payBtnText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 13,
        letterSpacing: 0.5,
    }
});
