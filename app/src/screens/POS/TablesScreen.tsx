import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import api from '../../api/client';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocket } from '../../hooks/useSocket';

const TOTAL_STANDARD_TABLES = 20;
const STANDARD_TABLES = Array.from({ length: TOTAL_STANDARD_TABLES }, (_, i) => `Table ${i + 1}`);

export default function TablesScreen({ navigation }: any) {
    const { loadOrder, clearCart, setTableNumber } = useCartStore();
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'my' | 'all'>('all');

    const fetchActiveOrders = async () => {
        try {
            // Fetch all unpaid orders (running tables)
            const response = await api.get('/orders?paymentStatus=unpaid&limit=100');
            setActiveOrders(response.data.data.orders || []);
        } catch (error) {
            console.error('Failed to fetch active tables', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const socket = useSocket();

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchActiveOrders();
        });
        return unsubscribe;
    }, [navigation]);

    // Real-time updates
    useEffect(() => {
        if (!socket) return;

        socket.on('kot:new', fetchActiveOrders);
        socket.on('kot:update', fetchActiveOrders);
        socket.on('kot:statusUpdate', fetchActiveOrders);
        socket.on('kot:itemUpdate', fetchActiveOrders);

        return () => {
            socket.off('kot:new', fetchActiveOrders);
            socket.off('kot:update', fetchActiveOrders);
            socket.off('kot:statusUpdate', fetchActiveOrders);
            socket.off('kot:itemUpdate', fetchActiveOrders);
        };
    }, [socket]);

    const handleTablePress = (tableNumber: string) => {
        const existingOrder = activeOrders.find(o => o.tableNumber === tableNumber);

        if (existingOrder) {
            // Load existing order into cart
            loadOrder(existingOrder);
        } else {
            // Start fresh cart for empty table
            clearCart();
            setTableNumber(tableNumber);
        }

        navigation.navigate('Billing');
    };



    const renderTable = ({ item: tableNumber }: { item: string }) => {
        const existingOrder = activeOrders.find(o => o.tableNumber === tableNumber);
        const isOccupied = !!existingOrder;

        let readyCount = 0;
        let servedCount = 0;
        let totalCount = 0;
        if (isOccupied) {
            totalCount = existingOrder.items.length;
            readyCount = existingOrder.items.filter((i: any) => i.status === 'ready').length;
            servedCount = existingOrder.items.filter((i: any) => i.status === 'served').length;
        }

        const allDone = isOccupied && (readyCount + servedCount) === totalCount;
        const hasReady = readyCount > 0;

        if (!isOccupied) {
            return (
                <TouchableOpacity
                    style={[styles.tableCardList, styles.tableCardEmptyList]}
                    activeOpacity={0.7}
                    onPress={() => handleTablePress(tableNumber)}
                >
                    <View style={styles.tableRowLeft}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="add" size={20} color={Colors.textSecondary} />
                        </View>
                        <Text style={styles.tableNumberEmptyList}>{tableNumber}</Text>
                    </View>
                    <Text style={styles.tableEmptyTextList}>Available</Text>
                </TouchableOpacity>
            );
        }

        const progressPercent = totalCount === 0 ? 0 : ((readyCount + servedCount) / totalCount) * 100;

        return (
            <TouchableOpacity
                style={[styles.tableCardList, styles.tableCardOccupiedList]}
                activeOpacity={0.85}
                onPress={() => handleTablePress(tableNumber)}
            >
                <LinearGradient
                    colors={['rgba(0,214,143,0.1)', 'rgba(0,168,107,0.02)']}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.tableHeaderRowList}>
                    <View style={styles.tableRowLeft}>
                        <Text style={styles.tableNumberOccupiedList}>{tableNumber}</Text>
                        {existingOrder?.waiterName && (
                            <View style={styles.waiterBadgeList}>
                                <Ionicons name="person" size={10} color={Colors.primary} />
                                <Text style={styles.waiterNameTextList} numberOfLines={1}>{existingOrder.waiterName}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.tableTimeTextList}>{totalCount} items</Text>
                    </View>
                </View>

                {/* Progress Bar Area */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressLabelsRow}>
                        <Text style={styles.progressLabel}>Status</Text>
                        <Text style={[styles.progressLabel, { color: allDone ? Colors.success : Colors.textSecondary }]}>
                            {readyCount + servedCount}/{totalCount} Completed
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <LinearGradient
                            colors={allDone ? ['#00C853', '#009624'] : ['#FFD54F', '#FFB300']}
                            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        />
                    </View>
                </View>

                {/* Expanded Action Buttons */}
                <View style={styles.tableActionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                        onPress={() => {
                            if (existingOrder) {
                                loadOrder(existingOrder);
                            }
                            navigation.navigate('Checkout', { tableNumber });
                        }}
                    >
                        <Ionicons name="receipt-outline" size={16} color={Colors.textMuted} />
                        <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>View Order</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: allDone ? Colors.success : Colors.error }]}
                        onPress={() => navigation.navigate('Checkout', { tableNumber, showPayment: true })}
                    >
                        <Ionicons name={allDone ? "wallet-outline" : "close-circle-outline"} size={16} color={Colors.white} />
                        <Text style={styles.actionBtnText}>{allDone ? 'Settle Bill' : 'Close Order'}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // Filter tables based on Search and Toggle
    const getFilteredTables = () => {
        let baseTables = STANDARD_TABLES;

        // Merge active orders that have custom table names
        const customTables = activeOrders
            .filter(o => !STANDARD_TABLES.includes(o.tableNumber))
            .map(o => o.tableNumber);

        // Ensure uniqueness
        baseTables = Array.from(new Set([...baseTables, ...customTables]));

        // Filter by "My Tables" vs "All Tables"
        if (filterMode === 'my') {
            const assigned = user?.assignedTables || [];
            baseTables = baseTables.filter(t => {
                const isAssignedExact = assigned.includes(t);
                const isAssignedNum = assigned.includes(t.replace('Table ', '').trim());
                const isCreatedByMe = activeOrders.some(o => o.tableNumber === t && o.createdBy === user?._id);
                return isAssignedExact || isAssignedNum || isCreatedByMe;
            });
        }

        // Filter by Search Query
        if (searchQuery.trim() !== '') {
            baseTables = baseTables.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return baseTables;
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <Text style={styles.headerTitle}>Tables</Text>

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search table..."
                                placeholderTextColor={Colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabBtn, filterMode === 'all' && styles.tabBtnActive]}
                            onPress={() => setFilterMode('all')}
                        >
                            <Text style={[styles.tabText, filterMode === 'all' && styles.tabTextActive]}>All Tables</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabBtn, filterMode === 'my' && styles.tabBtnActive]}
                            onPress={() => setFilterMode('my')}
                        >
                            <Text style={[styles.tabText, filterMode === 'my' && styles.tabTextActive]}>My Tables</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isLoading && activeOrders.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={getFilteredTables()}
                        keyExtractor={(item) => item}
                        renderItem={renderTable}
                        contentContainerStyle={styles.listContentList}
                        showsVerticalScrollIndicator={false}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            setIsRefreshing(true);
                            fetchActiveOrders();
                        }}
                        ListFooterComponent={
                            (user?.role === 'owner' || user?.role === 'manager') ? (
                                <TouchableOpacity
                                    style={styles.historyBtn}
                                    onPress={() => navigation.navigate('OrderHistory')}
                                >
                                    <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                                    <Text style={styles.historyBtnText}>View Order History</Text>
                                </TouchableOpacity>
                            ) : null
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
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    headerTitle: { ...Typography.h2, color: Colors.white, fontWeight: '800' },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.round, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: Colors.white, ...Typography.body2 },
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: Radius.round, padding: 4, marginTop: Spacing.md },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.round },
    tabBtnActive: { backgroundColor: Colors.primary },
    tabText: { ...Typography.buttonSm, color: Colors.textMuted },
    tabTextActive: { color: Colors.white, fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // List Layout Cards
    listContentList: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm },
    tableCardList: { marginBottom: Spacing.md, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, padding: Spacing.lg },
    tableCardEmptyList: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tableRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    tableNumberEmptyList: { ...Typography.h4, color: Colors.textSecondary },
    tableEmptyTextList: { ...Typography.body2, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

    tableCardOccupiedList: { backgroundColor: Colors.card, borderColor: 'rgba(0,214,143,0.3)', shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
    tableHeaderRowList: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    tableNumberOccupiedList: { ...Typography.h3, color: Colors.white, fontWeight: '800' },
    waiterBadgeList: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,53,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
    waiterNameTextList: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
    tableTotalTextList: { ...Typography.h4, color: Colors.white, fontWeight: '700' },
    tableTimeTextList: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
    settleBtnMini: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.round },
    settleBtnMiniText: { ...Typography.buttonSm, color: Colors.white, fontSize: 12 },

    // Progress Bar
    progressContainer: { marginTop: Spacing.xs },
    progressLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11 },
    progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.round, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: Radius.round },

    // Action Row
    tableActionRow: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md },
    actionBtnText: { ...Typography.buttonSm, color: Colors.white, fontWeight: '600' },

    // History Button
    historyBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: Spacing.xl, marginBottom: Spacing.xl,
        paddingVertical: 16, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)',
    },
    historyBtnText: { ...Typography.button, color: Colors.textSecondary, fontWeight: '600' },
});
