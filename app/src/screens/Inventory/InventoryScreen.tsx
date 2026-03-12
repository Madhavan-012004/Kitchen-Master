import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { inventoryAPI } from '../../api/inventory';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function InventoryScreen({ navigation }: any) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'low'>('all');
    const listAnim = useRef(new Animated.Value(0)).current;

    const fetchInventory = async () => {
        try {
            const res = await inventoryAPI.getAll();
            setItems(res.data.data.items);
        } catch (e) { console.error(e); }
        finally {
            setLoading(false);
            Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    };

    useEffect(() => { fetchInventory(); }, []);

    const lowItems = items.filter(i => i.currentStock <= i.lowStockThreshold);
    const displayItems = filter === 'low' ? lowItems : items;

    const getStockPercent = (item: any) => {
        const max = item.maxStock || item.lowStockThreshold * 4;
        return Math.min(100, Math.round((item.currentStock / max) * 100));
    };

    const getStockColor = (item: any) => {
        const p = getStockPercent(item);
        if (p > 60) return Colors.accentGreen;
        if (p > 25) return Colors.accentYellow;
        return Colors.error;
    };

    const renderItem = ({ item, index }: any) => {
        const isLow = item.currentStock <= item.lowStockThreshold;
        const pct = getStockPercent(item);
        const barColor = getStockColor(item);

        return (
            <Animated.View style={[styles.card, { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.04)', 'transparent']}
                    style={styles.cardGradient}
                >
                    <View style={styles.cardTop}>
                        <View style={styles.cardMeta}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemCategory}>{item.category || 'Raw Materials'}</Text>
                        </View>
                        <View style={styles.stockInfo}>
                            <Text style={[styles.stockValue, { color: barColor }]}>{item.currentStock}</Text>
                            <Text style={styles.unit}>{item.unit}</Text>
                        </View>
                    </View>

                    {/* Stock progress bar */}
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>

                    <View style={styles.cardBottom}>
                        {isLow ? (
                            <View style={styles.alertChip}>
                                <View style={styles.alertDot} />
                                <Text style={styles.alertText}>Low Stock</Text>
                            </View>
                        ) : (
                            <Text style={styles.pctText}>{pct}% remaining</Text>
                        )}
                        <TouchableOpacity style={styles.restockBtn} activeOpacity={0.85}>
                            <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.restockGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Ionicons name="add" size={14} color={Colors.white} />
                                <Text style={styles.restockText}>Restock</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </Animated.View>
        );
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Inventory</Text>
                        <Text style={styles.subtitle}>{items.length} items tracked</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddInventory')}>
                        <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.addBtnGradient}>
                            <Ionicons name="add" size={22} color={Colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <LinearGradient colors={['#1A2040', '#141830']} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: 'rgba(76,142,255,0.15)' }]}>
                            <Ionicons name="cube-outline" size={18} color={Colors.accentBlue} />
                        </View>
                        <Text style={styles.statVal}>{items.length}</Text>
                        <Text style={styles.statLabel}>Total Items</Text>
                    </LinearGradient>
                    <LinearGradient colors={['#1A2040', '#141830']} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: 'rgba(255,202,40,0.15)' }]}>
                            <Ionicons name="warning-outline" size={18} color={Colors.accentYellow} />
                        </View>
                        <Text style={[styles.statVal, { color: Colors.accentYellow }]}>{lowItems.length}</Text>
                        <Text style={styles.statLabel}>Low Stock</Text>
                    </LinearGradient>
                    <LinearGradient colors={['#1A2040', '#141830']} style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: 'rgba(0,214,143,0.15)' }]}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accentGreen} />
                        </View>
                        <Text style={[styles.statVal, { color: Colors.accentGreen }]}>{items.length - lowItems.length}</Text>
                        <Text style={styles.statLabel}>In Stock</Text>
                    </LinearGradient>
                </View>

                {/* Filter tabs */}
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.filterTab, filter === 'all' && styles.filterActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All Items</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, filter === 'low' && styles.filterActiveWarn]}
                        onPress={() => setFilter('low')}
                    >
                        <Text style={[styles.filterText, filter === 'low' && { color: Colors.accentYellow }]}>Low Stock {lowItems.length > 0 && `(${lowItems.length})`}</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={displayItems}
                        renderItem={renderItem}
                        keyExtractor={i => i._id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Ionicons name="cube-outline" size={52} color={Colors.textMuted} />
                                <Text style={styles.emptyTitle}>No items found</Text>
                                <Text style={styles.emptyText}>Your inventory is empty</Text>
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
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    title: { ...Typography.h3, color: Colors.textPrimary },
    subtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    addBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.primary },
    addBtnGradient: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.md },
    statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
    statCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center',
        gap: 6, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statVal: { ...Typography.h3, color: Colors.textPrimary },
    statLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
    filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
    filterTab: {
        paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.round,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    },
    filterActive: { backgroundColor: 'rgba(255,107,53,0.12)', borderColor: 'rgba(255,107,53,0.4)' },
    filterActiveWarn: { backgroundColor: 'rgba(255,202,40,0.1)', borderColor: 'rgba(255,202,40,0.4)' },
    filterText: { ...Typography.buttonSm, color: Colors.textMuted },
    filterTextActive: { color: Colors.primary },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },
    card: {
        borderRadius: Radius.lg, marginBottom: Spacing.md, overflow: 'hidden',
        borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, ...Shadows.sm,
    },
    cardGradient: { padding: Spacing.md },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    cardMeta: { flex: 1 },
    itemName: { ...Typography.h5, color: Colors.textPrimary },
    itemCategory: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
    stockInfo: { alignItems: 'flex-end' },
    stockValue: { ...Typography.h3 },
    unit: { ...Typography.caption, color: Colors.textMuted },
    progressBg: { height: 6, backgroundColor: Colors.glass, borderRadius: 3, marginBottom: Spacing.md, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    alertChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
    alertText: { ...Typography.caption, color: Colors.error, fontWeight: '700' },
    pctText: { ...Typography.caption, color: Colors.textMuted },
    restockBtn: { borderRadius: Radius.md, overflow: 'hidden' },
    restockGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
    restockText: { ...Typography.buttonSm, color: Colors.white, fontSize: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 8 },
    emptyTitle: { ...Typography.h4, color: Colors.textSecondary },
    emptyText: { ...Typography.body2, color: Colors.textMuted },
});
