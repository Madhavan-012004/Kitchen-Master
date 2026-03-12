import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Alert, Share, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import api from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';

// Filter Pickers using a simplified custom approach since standard RN Picker varies heavily
const FilterPill = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
    <TouchableOpacity
        style={[styles.filterPill, active && styles.filterPillActive]}
        onPress={onPress}
    >
        <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </TouchableOpacity>
);

export default function OrderHistoryScreen({ navigation }: any) {
    const { user } = useAuthStore();
    const isOwner = user?.role === 'owner';

    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    const fetchHistory = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            params.append('limit', '50');

            // Only fetch for today on mobile to keep it fast, can expand if needed
            const today = new Date().toISOString().split('T')[0];
            params.append('date', today);

            if (filterType !== 'All') params.append('orderType', filterType);
            if (filterStatus !== 'All') params.append('status', filterStatus);

            const response = await api.get(`/orders?${params.toString()}`);
            setOrders(response.data.data.orders || []);
        } catch (error) {
            console.error('Failed to fetch order history', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [filterType, filterStatus]);

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

    const formatTime = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'preparing': return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
            case 'ready': return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
            case 'served': return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' };
            case 'paid': return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
            case 'completed': return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
            case 'cancelled': return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
            default: return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
        }
    };

    const renderOrderItem = ({ item }: { item: any }) => {
        const statusStyle = getStatusStyle(item.status);
        const isTakeaway = item.orderType === 'takeaway';

        return (
            <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.typeBadge,
                        { backgroundColor: isTakeaway ? '#faf5ff' : '#eff6ff', borderColor: isTakeaway ? '#e9d5ff' : '#bfdbfe' }
                        ]}>
                            <Text style={[styles.typeText, { color: isTakeaway ? '#9333ea' : '#2563eb' }]}>
                                {isTakeaway ? '🥡 Takeaway' : '🍽️ Dine-In'}
                            </Text>
                        </View>
                        <Text style={styles.orderNumberTitle}>
                            {item.tableNumber ? item.tableNumber : (item.tokenNumber ? `Token ${item.tokenNumber}` : 'Takeaway')}
                        </Text>
                    </View>
                    <View style={styles.timeBadgeView}>
                        <Text style={styles.timeBadgeText}>{formatTime(item.createdAt)}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.itemsCount}>{item.items?.length || 0} Items</Text>
                    <Text style={styles.itemsPreview} numberOfLines={2}>
                        {item.items?.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}
                    </Text>
                </View>

                <View style={styles.cardFooter}>
                    <View>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₹{(item.total || item.totalAmount || 0).toFixed(0)}</Text>
                    </View>
                    <View style={styles.footerRight}>
                        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusStyle.text }]} />
                            <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                        </View>
                        {isOwner && (
                            <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteBtn}>
                                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={24} color={Colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Order History</Text>
                        {isOwner ? (
                            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                                <Ionicons name="download-outline" size={20} color={Colors.white} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.exportBtn} />
                        )}
                    </View>
                </View>

                {/* Filters Section */}
                <View style={styles.filtersSection}>
                    <Text style={styles.filterSectionTitle}>Order Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                        {['All', 'dine-in', 'takeaway'].map(type => (
                            <FilterPill
                                key={type}
                                label={type === 'All' ? 'All Types' : (type === 'dine-in' ? 'Dine-In' : 'Takeaway')}
                                active={filterType === type}
                                onPress={() => setFilterType(type)}
                            />
                        ))}
                    </ScrollView>

                    <Text style={[styles.filterSectionTitle, { marginTop: 12 }]}>Status</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                        {['All', 'preparing', 'ready', 'served', 'paid', 'cancelled'].map(status => (
                            <FilterPill
                                key={status}
                                label={status.charAt(0).toUpperCase() + status.slice(1)}
                                active={filterStatus === status}
                                onPress={() => setFilterStatus(status)}
                            />
                        ))}
                    </ScrollView>
                </View>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={orders}
                        keyExtractor={(item) => item._id}
                        renderItem={renderOrderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            setIsRefreshing(true);
                            fetchHistory();
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Ionicons name="receipt-outline" size={60} color={Colors.textMuted} />
                                <Text style={styles.emptyText}>No orders found.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
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
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },

    filtersSection: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        marginBottom: Spacing.sm
    },
    filterSectionTitle: {
        ...Typography.caption,
        color: Colors.textMuted,
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    filterPillActive: {
        backgroundColor: 'rgba(255, 107, 53, 0.15)',
        borderColor: Colors.primary
    },
    filterPillText: {
        ...Typography.body2,
        color: Colors.textSecondary,
        fontWeight: '600'
    },
    filterPillTextActive: {
        color: Colors.primary,
        fontWeight: '700'
    },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 100 },
    emptyText: { ...Typography.h4, color: Colors.textMuted },

    // Modern Cards
    orderCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.glassBorder,
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
        ...Typography.h4, color: Colors.textPrimary, fontWeight: '800'
    },
    timeBadgeView: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    timeBadgeText: {
        ...Typography.caption,
        color: Colors.textSecondary,
        fontWeight: '600'
    },

    cardBody: {
        paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
        marginBottom: 12
    },
    itemsCount: {
        ...Typography.caption,
        color: Colors.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4
    },
    itemsPreview: {
        ...Typography.body2,
        color: Colors.textSecondary,
        lineHeight: 20
    },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { ...Typography.caption, color: Colors.textMuted },
    totalValue: { ...Typography.h3, color: Colors.white, fontWeight: '800' },

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

    deleteBtn: { width: 32, height: 32, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: Radius.round, justifyContent: 'center', alignItems: 'center' },
});
