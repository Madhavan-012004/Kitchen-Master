import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Animated, StatusBar, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { inventoryAPI } from '../../api/inventory';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import AdjustStockModal from './AdjustStockModal';

export default function InventoryScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    
    // Tabs & Items
    const [activeTab, setActiveTab] = useState<'stock' | 'activity'>('stock');
    const [items, setItems] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters & Modals
    const [filter, setFilter] = useState<'all' | 'low'>('all');
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    
    const listAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        else setRefreshing(true);
        
        try {
            const [itemRes, moveRes] = await Promise.all([
                inventoryAPI.getAll(),
                inventoryAPI.getMovements()
            ]);
            setItems(itemRes.data.data?.items || []);
            setMovements(moveRes.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }, [listAnim]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAdjustStock = async (data: any) => {
        if (!selectedItem) return;
        try {
            await inventoryAPI.adjustStock(selectedItem._id || selectedItem.id, data);
            fetchData(true); // Silent refresh
        } catch (error) {
            console.error(error);
        }
    };

    const safeItems = Array.isArray(items) ? items : [];
    const lowItems = safeItems.filter(i => i.currentStock <= i.lowStockThreshold);
    const displayItems = filter === 'low' ? lowItems : safeItems;

    const getStockPercent = (item: any) => {
        const max = item.lowStockThreshold * 4 || 10;
        return Math.min(100, Math.round((item.currentStock / max) * 100));
    };

    const getStockColor = (item: any) => {
        const isLow = item.currentStock <= item.lowStockThreshold;
        const isCritical = item.currentStock === 0;
        if (isCritical) return colors.error;
        if (isLow) return colors.warning;
        return colors.accentGreen || colors.success;
    };

    const renderStockItem = ({ item }: any) => {
        const isLow = item.currentStock <= item.lowStockThreshold;
        const pct = getStockPercent(item);
        const barColor = getStockColor(item);

        return (
            <View style={themedStyles.card}>
                <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.04)', 'transparent'] : ['rgba(0,0,0,0.02)', 'transparent']}
                    style={themedStyles.cardGradient}
                >
                    <View style={themedStyles.cardTop}>
                        <View style={themedStyles.cardMeta}>
                            <Text style={themedStyles.itemName}>{item.name}</Text>
                            <Text style={themedStyles.itemCategory}>{item.category || 'General'}</Text>
                        </View>
                        <View style={themedStyles.stockInfo}>
                            <Text style={[themedStyles.stockValue, { color: barColor }]}>
                                {item.currentStock}
                            </Text>
                            <Text style={themedStyles.unit}>{item.unit}</Text>
                        </View>
                    </View>

                    <View style={themedStyles.progressBg}>
                        <View style={[themedStyles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>

                    <View style={themedStyles.cardBottom}>
                        <View style={[themedStyles.statusBadge, { backgroundColor: barColor + '26' }]}>
                            <Text style={[themedStyles.statusText, { color: barColor }]}>
                                {item.currentStock === 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'Optimal'}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={themedStyles.adjustBtn} 
                            onPress={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                        >
                            <Ionicons name="flash" size={14} color={colors.primary} />
                            <Text style={themedStyles.adjustText}>Adjust</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const renderMovementItem = ({ item }: any) => {
        const isDeduct = item.type === 'DEDUCT';
        const color = item.type === 'ADD' ? colors.success : item.type === 'DEDUCT' ? colors.error : colors.textMuted;
        const date = new Date(item.timestamp);

        return (
            <View style={themedStyles.movementCard}>
                <View style={themedStyles.moveTop}>
                    <View style={themedStyles.moveInfo}>
                        <Text style={themedStyles.moveItemName}>{item.itemName}</Text>
                        <Text style={themedStyles.moveTime}>
                            {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View style={themedStyles.moveQtyWrap}>
                        <Text style={[themedStyles.moveQty, { color }]}>
                            {isDeduct ? '-' : '+'}{item.quantity}
                        </Text>
                        <Text style={themedStyles.moveUnit}>{item.inventoryItem?.unit}</Text>
                    </View>
                </View>
                
                <View style={[themedStyles.moveDivider, { backgroundColor: colors.border }]} />
                
                <View style={themedStyles.moveBottom}>
                    <View style={themedStyles.staffPill}>
                        <View style={[themedStyles.avatar, { backgroundColor: colors.primary }]}>
                            <Text style={themedStyles.avatarText}>{item.performedByName?.[0]}</Text>
                        </View>
                        <Text style={themedStyles.staffName}>{item.performedByName}</Text>
                    </View>
                    <Text style={themedStyles.reasonText} numberOfLines={1}>
                        {item.reason || 'Manual Adjustment'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                {/* Header with Tabs */}
                <View style={themedStyles.header}>
                    <View>
                        <Text style={themedStyles.title}>Management</Text>
                        <View style={themedStyles.tabSwitcher}>
                            <TouchableOpacity 
                                style={[themedStyles.tab, activeTab === 'stock' && themedStyles.activeTab]}
                                onPress={() => setActiveTab('stock')}
                            >
                                <Text style={[themedStyles.tabText, activeTab === 'stock' && themedStyles.activeTabText]}>Stock Levels</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[themedStyles.tab, activeTab === 'activity' && themedStyles.activeTab]}
                                onPress={() => setActiveTab('activity')}
                            >
                                <Text style={[themedStyles.tabText, activeTab === 'activity' && themedStyles.activeTabText]}>Activity Log</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={themedStyles.addBtn} onPress={() => navigation.navigate('Expenditure')}>
                            <LinearGradient colors={['#64748b', '#475569']} style={themedStyles.addBtnGradient}>
                                <Ionicons name="receipt" size={20} color={colors.white} />
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={themedStyles.addBtn} onPress={() => navigation.navigate('AddInventory')}>
                            <LinearGradient colors={gradients.primary} style={themedStyles.addBtnGradient}>
                                <Ionicons name="add" size={24} color={colors.white} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'stock' ? (
                    <Animated.View style={{ flex: 1, opacity: listAnim }}>
                        <View style={themedStyles.statsRow}>
                            <View style={themedStyles.statCard}>
                                <Text style={themedStyles.statVal}>{items.length}</Text>
                                <Text style={themedStyles.statLabel}>Items</Text>
                            </View>
                            <View style={themedStyles.statCard}>
                                <Text style={[themedStyles.statVal, { color: colors.warning }]}>{lowItems.length}</Text>
                                <Text style={themedStyles.statLabel}>Low</Text>
                            </View>
                            <View style={themedStyles.statCard}>
                                <Text style={[themedStyles.statVal, { color: colors.error }]}>
                                    {items.filter(i => i.currentStock === 0).length}
                                </Text>
                                <Text style={themedStyles.statLabel}>Out</Text>
                            </View>
                        </View>

                        <View style={themedStyles.filterRow}>
                            <TouchableOpacity
                                style={[themedStyles.filterTab, filter === 'all' && themedStyles.filterActive]}
                                onPress={() => setFilter('all')}
                            >
                                <Text style={[themedStyles.filterText, filter === 'all' && themedStyles.filterTextActive]}>All Items</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[themedStyles.filterTab, filter === 'low' && themedStyles.filterActiveWarn]}
                                onPress={() => setFilter('low')}
                            >
                                <Text style={[themedStyles.filterText, filter === 'low' && { color: colors.warning }]}>Low Stock Alerts</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={displayItems}
                            renderItem={renderStockItem}
                            keyExtractor={i => i._id || i.id}
                            contentContainerStyle={themedStyles.list}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.primary} />}
                            ListEmptyComponent={
                                <View style={themedStyles.center}>
                                    <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
                                    <Text style={themedStyles.emptyTitle}>No items found</Text>
                                </View>
                            }
                        />
                    </Animated.View>
                ) : (
                    <Animated.View style={{ flex: 1, opacity: listAnim }}>
                        <FlatList
                            data={movements}
                            renderItem={renderMovementItem}
                            keyExtractor={(i, idx) => i.id || idx.toString()}
                            contentContainerStyle={themedStyles.list}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.primary} />}
                            ListEmptyComponent={
                                <View style={themedStyles.center}>
                                    <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                                    <Text style={themedStyles.emptyTitle}>No history recorded</Text>
                                </View>
                            }
                        />
                    </Animated.View>
                )}
            </SafeAreaView>

            <AdjustStockModal 
                visible={showAdjustModal}
                onClose={() => setShowAdjustModal(false)}
                item={selectedItem}
                onSubmit={handleAdjustStock}
            />
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
    tabSwitcher: { flexDirection: 'row', gap: 16, marginTop: 12 },
    tab: { paddingVertical: 4 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { ...Typography.body1, color: colors.textMuted, fontWeight: '700' },
    activeTabText: { color: colors.textPrimary },
    addBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.glow },
    addBtnGradient: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 12, marginBottom: Spacing.lg },
    statCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.sm,
    },
    statVal: { ...Typography.h3, color: colors.textPrimary, fontWeight: '900' },
    statLabel: { ...Typography.caption, color: colors.textMuted, fontWeight: '700' },
    filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
    filterTab: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary + '1F', borderColor: colors.primary },
    filterActiveWarn: { backgroundColor: colors.warning + '1A', borderColor: colors.warning },
    filterText: { ...Typography.buttonSm, color: colors.textMuted },
    filterTextActive: { color: colors.primary },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    card: {
        borderRadius: Radius.xl, marginBottom: Spacing.md, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.sm,
    },
    cardGradient: { padding: Spacing.lg },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    cardMeta: { flex: 1 },
    itemName: { ...Typography.h5, color: colors.textPrimary, fontWeight: '800' },
    itemCategory: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    stockInfo: { alignItems: 'flex-end' },
    stockValue: { ...Typography.h2, fontWeight: '900' },
    unit: { ...Typography.caption, color: colors.textMuted, fontWeight: '700' },
    progressBg: { height: 8, backgroundColor: colors.glass, borderRadius: 4, marginBottom: 20, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { ...Typography.caption, fontWeight: '800', textTransform: 'uppercase' },
    adjustBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: colors.border },
    adjustText: { ...Typography.buttonSm, color: colors.primary, fontWeight: '800' },
    
    // Movement Items
    movementCard: {
        backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.md,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border, ...Shadows.sm,
    },
    moveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    moveInfo: { flex: 1 },
    moveItemName: { ...Typography.body1, color: colors.textPrimary, fontWeight: '800' },
    moveTime: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    moveQtyWrap: { alignItems: 'flex-end' },
    moveQty: { ...Typography.h4, fontWeight: '900' },
    moveUnit: { ...Typography.caption, color: colors.textMuted },
    moveDivider: { height: 1, marginVertical: 4 },
    moveBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    staffPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.glass, padding: 4, paddingRight: 10, borderRadius: 20 },
    avatar: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    staffName: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    reasonText: { fontSize: 11, color: colors.textMuted, maxWidth: '50%' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, gap: 12 },
    emptyTitle: { ...Typography.h4, color: colors.textMuted },
});
