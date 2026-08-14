import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Alert, Share, Platform, ScrollView, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import api from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';

// Filter Pickers using a simplified custom approach
const FilterPill = ({ label, active, onPress, colors, themedStyles }: { label: string, active: boolean, onPress: () => void, colors: any, themedStyles: any }) => (
    <TouchableOpacity
        style={[
            themedStyles.filterPill,
            { backgroundColor: colors.glass, borderColor: colors.border },
            active && { backgroundColor: colors.primary + '26', borderColor: colors.primary }
        ]}
        onPress={onPress}
    >
        <Text style={[
            themedStyles.filterPillText,
            { color: colors.textSecondary },
            active && { color: colors.primary, fontWeight: '700' }
        ]}>{label}</Text>
    </TouchableOpacity>
);

export default function OrderHistoryScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();

    const getDisplayOrderNumber = (order: any) => {
        if (order && order.notes && typeof order.notes === 'string') {
            const match = order.notes.match(/\|\|BILLNO:([^|]+)\|\|/);
            if (match && match[1]) return match[1];
        }
        return order ? (order.orderNumber || String(order._id).slice(-8).toUpperCase()) : '';
    };

    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const { user } = useAuthStore();
    const isOwner = user?.role === 'owner';

    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPeriod, setFilterPeriod] = useState('today'); // 'today' | 'week' | 'all'

    const fetchHistory = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            params.append('limit', '100');

            if (filterPeriod === 'today') {
                const today = new Date().toISOString().split('T')[0];
                params.append('date', today);
            }

            if (filterType !== 'All') params.append('orderType', filterType);
            if (filterStatus !== 'All') params.append('status', filterStatus);

            const response = await api.get(`/orders/history?${params.toString()}`);
            let fetched: any[] = response.data.data?.orders || [];

            if (filterPeriod === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                fetched = fetched.filter((o: any) => new Date(o.createdAt) >= weekAgo);
            }

            setOrders(fetched);
        } catch (error: any) {
            console.error('Failed to fetch order history', error?.response?.data || error?.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [filterType, filterStatus, filterPeriod]);

    useEffect(() => {
        setIsLoading(true);
        fetchHistory();
    }, [fetchHistory]);

    const handleDelete = (orderId: string) => {
        Alert.alert('Delete Order', 'Are you sure you want to permanently delete this order?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`/orders/${orderId}`);
                        fetchHistory();
                    } catch (error) {
                        console.error('Failed to delete order', error);
                        Alert.alert('Error', 'Failed to delete order.');
                    }
                }
            }
        ]);
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/orders/export/csv');
            await Share.share({
                message: response.data,
                title: 'Orders Export CSV'
            });
        } catch (error) {
            console.error('Failed to export orders', error);
            Alert.alert('Error', 'Failed to export orders.');
        }
    };

    const handleA4Invoice = async (orderId: string, orderNumber: string) => {
        try {
            const baseUrl = api.defaults.baseURL || '';
            const downloadUrl = `${baseUrl.replace('/api', '')}/api/orders/${orderId}/invoice/a4`;
            Linking.openURL(downloadUrl);
        } catch (error) {
            console.error('Failed to download invoice', error);
            Alert.alert('Error', 'Failed to download invoice.');
        }
    };

    const handleWhatsApp = (order: any) => {
        Alert.prompt(
            'WhatsApp Receipt',
            'Enter customer WhatsApp number (e.g. 919876543210):',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: (phone) => {
                        if (!phone) return;
                        const text = `*${user?.restaurantName || 'RESTAURANT'}*\n\nOrder #${getDisplayOrderNumber(order)}\nAmount: ₹${order.total?.toFixed(2) || order.subtotal?.toFixed(2) || 0}\nStatus: ${order.status || 'PREPARING'}\n\nThank you for your order!`;
                        const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
                        Linking.canOpenURL(url).then(supported => {
                            if (supported) {
                                Linking.openURL(url);
                            } else {
                                const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                                Linking.openURL(webUrl);
                            }
                        });
                    }
                }
            ],
            'plain-text',
            order.customerPhone || ''
        );
    };

    const formatTime = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusTheme = (status: string) => {
        const s = status?.toUpperCase();
        if (s === 'PREPARING') return { bg: colors.warning + '1A', text: colors.warning, border: colors.warning + '4D' };
        if (s === 'READY') return { bg: colors.primary + '1A', text: colors.primary, border: colors.primary + '4D' };
        if (s === 'SERVED') return { bg: (colors.accentPurple || '#A855F7') + '1A', text: colors.accentPurple || '#A855F7', border: (colors.accentPurple || '#A855F7') + '4D' };
        if (s === 'PAID' || s === 'COMPLETED') return { bg: colors.success + '1A', text: colors.success, border: colors.success + '4D' };
        if (s === 'CANCELLED') return { bg: colors.error + '1A', text: colors.error, border: colors.error + '4D' };
        return { bg: colors.border, text: colors.textSecondary, border: colors.border };
    };

    const renderOrderItem = ({ item }: { item: any }) => {
        const st = getStatusTheme(item.status);
        const isTakeaway = item.orderType === 'takeaway';

        return (
            <View style={themedStyles.orderCard}>
                <View style={themedStyles.cardHeader}>
                    <View style={themedStyles.headerLeft}>
                        <View style={[themedStyles.typeBadge,
                        {
                            backgroundColor: isTakeaway ? (colors.accentPurple || '#A855F7') + '1A' : colors.primary + '1A',
                            borderColor: isTakeaway ? (colors.accentPurple || '#A855F7') + '4D' : colors.primary + '4D'
                        }
                        ]}>
                            <Text style={[themedStyles.typeText, { color: isTakeaway ? (colors.accentPurple || '#A855F7') : colors.primary }]}>
                                {isTakeaway ? '🥡 Takeaway' : '🍽️ Dine-In'}
                            </Text>
                        </View>
                        <Text style={themedStyles.orderNumberTitle}>
                            {item.tableNumber ? item.tableNumber : (item.tokenNumber ? `Token ${item.tokenNumber}` : `Bill #${getDisplayOrderNumber(item)}`)}
                        </Text>
                    </View>
                    <View style={themedStyles.timeBadgeView}>
                        <Text style={themedStyles.timeBadgeText}>{formatTime(item.createdAt)}</Text>
                    </View>
                </View>

                <View style={themedStyles.cardBody}>
                    <Text style={themedStyles.itemsCount}>{item.items?.length || 0} Items</Text>
                    <Text style={themedStyles.itemsPreview} numberOfLines={2}>
                        {item.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                    </Text>
                </View>

                <View style={themedStyles.cardFooter}>
                    <View>
                        <Text style={themedStyles.totalLabel}>Total</Text>
                        <Text style={themedStyles.totalValue}>₹{(item.total || item.totalAmount || 0).toFixed(0)}</Text>
                    </View>
                    <View style={themedStyles.footerRight}>
                        <View style={[themedStyles.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
                            <View style={[themedStyles.statusDot, { backgroundColor: st.text }]} />
                            <Text style={[themedStyles.statusText, { color: st.text }]}>
                                {item.status
                                    ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()
                                    : 'Unknown'}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity onPress={() => handleA4Invoice(item._id, item.orderNumber)} style={[themedStyles.actionBtn, { backgroundColor: '#3b82f61A' }]}>
                                <Text style={{ fontSize: 16 }}>📄</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleWhatsApp(item)} style={[themedStyles.actionBtn, { backgroundColor: '#25D3661A' }]}>
                                <Text style={{ fontSize: 16 }}>💬</Text>
                            </TouchableOpacity>
                            {isOwner && (
                                <TouchableOpacity onPress={() => handleDelete(item._id)} style={themedStyles.deleteBtn}>
                                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                <View style={themedStyles.header}>
                    <View style={themedStyles.headerTop}>
                        <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={themedStyles.headerTitle}>Order History</Text>
                        {isOwner ? (
                            <TouchableOpacity style={themedStyles.exportBtn} onPress={handleExport}>
                                <Ionicons name="download-outline" size={20} color={colors.white} />
                            </TouchableOpacity>
                        ) : (
                            <View style={themedStyles.exportBtn} />
                        )}
                    </View>
                </View>

                {/* Period Filters */}
                <View style={themedStyles.filtersSection}>
                    <Text style={themedStyles.filterSectionTitle}>Period</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={themedStyles.filtersRow}>
                        {[{ key: 'today', label: '📅 Today' }, { key: 'week', label: '📆 This Week' }, { key: 'all', label: '🗂️ All Time' }].map(p => (
                            <FilterPill key={p.key} label={p.label} active={filterPeriod === p.key} onPress={() => setFilterPeriod(p.key)} colors={colors} themedStyles={themedStyles} />
                        ))}
                    </ScrollView>

                    <Text style={[themedStyles.filterSectionTitle, { marginTop: 12 }]}>Order Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={themedStyles.filtersRow}>
                        {['All', 'dine-in', 'takeaway'].map(type => (
                            <FilterPill
                                key={type}
                                label={type === 'All' ? 'All Types' : (type === 'dine-in' ? 'Dine-In' : 'Takeaway')}
                                active={filterType === type}
                                onPress={() => setFilterType(type)}
                                colors={colors}
                                themedStyles={themedStyles}
                            />
                        ))}
                    </ScrollView>

                    <Text style={[themedStyles.filterSectionTitle, { marginTop: 12 }]}>Status</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={themedStyles.filtersRow}>
                        {['All', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map(status => (
                            <FilterPill
                                key={status}
                                label={status.charAt(0).toUpperCase() + status.slice(1)}
                                active={filterStatus === status}
                                onPress={() => setFilterStatus(status)}
                                colors={colors}
                                themedStyles={themedStyles}
                            />
                        ))}
                    </ScrollView>
                </View>

                {isLoading ? (
                    <View style={themedStyles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={orders}
                        keyExtractor={(item) => item._id}
                        renderItem={renderOrderItem}
                        contentContainerStyle={themedStyles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            setIsRefreshing(true);
                            fetchHistory();
                        }}
                        ListEmptyComponent={
                            <View style={themedStyles.emptyWrap}>
                                <Ionicons name="receipt-outline" size={60} color={colors.textMuted} />
                                <Text style={themedStyles.emptyText}>No orders found.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    headerTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    exportBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },

    filtersSection: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: Spacing.sm
    },
    filterSectionTitle: {
        ...Typography.caption,
        color: colors.textMuted,
        marginBottom: 8,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 20
    },
    filterPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.glass,
        borderWidth: 1,
        borderColor: colors.border
    },
    filterPillText: {
        ...Typography.body2,
        color: colors.textSecondary,
        fontWeight: '600'
    },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 100 },
    emptyText: { ...Typography.h4, color: colors.textMuted },

    orderCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: colors.border,
        padding: 16, marginBottom: Spacing.md,
        ...Shadows.sm
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12
    },
    headerLeft: {
        alignItems: 'flex-start',
        gap: 6
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1
    },
    typeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    orderNumberTitle: {
        ...Typography.h4, color: colors.textPrimary, fontWeight: '800'
    },
    timeBadgeView: {
        backgroundColor: colors.glass,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border
    },
    timeBadgeText: {
        ...Typography.caption,
        color: colors.textSecondary,
        fontWeight: '600'
    },

    cardBody: {
        paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        marginBottom: 12
    },
    itemsCount: {
        ...Typography.caption,
        color: colors.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4
    },
    itemsPreview: {
        ...Typography.body2,
        color: colors.textSecondary,
        lineHeight: 20
    },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { ...Typography.caption, color: colors.textMuted },
    totalValue: { ...Typography.h3, color: colors.textPrimary, fontWeight: '800' },

    footerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    statusPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, fontWeight: '700' },

    actionBtn: { width: 32, height: 32, borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
    deleteBtn: { width: 32, height: 32, backgroundColor: colors.error + '1A', borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
});
