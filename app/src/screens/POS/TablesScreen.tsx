import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import api from '../../api/client';
import { useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSocket } from '../../hooks/useSocket';
import { NotificationBell } from '../../components/NotificationBell';

export default function TablesScreen({ navigation }: any) {
    const { loadOrder, clearCart, setTableNumber } = useCartStore();
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { user } = useAuthStore();
    const { colors, gradients, isDark } = useAppTheme();
    const styles = React.useMemo(() => createStyles(colors, gradients), [colors, gradients]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'my' | 'all'>('all');
    
    // Merge Modal State
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [selectedTableForMerge, setSelectedTableForMerge] = useState('');
    const [combineTargetTable, setCombineTargetTable] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const [selectedMyTable, setSelectedMyTable] = useState<string | null>(null);

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
        const existingOrder = activeOrders.find(o => 
            o.tableNumber === tableNumber || 
            (o.mergedTables && o.mergedTables.split(',').map((t: string) => t.trim()).includes(tableNumber))
        );

        if (existingOrder) {
            // Load existing order into cart
            loadOrder(existingOrder);
        } else {
            // Start fresh cart for empty table
            clearCart();
            setTableNumber(tableNumber);
        }

        navigation.navigate('Order');
    };

    const handleLongPressTable = (tableNumber: string) => {
        setSelectedTableForMerge(tableNumber);
        setCombineTargetTable('');
        setShowMergeModal(true);
    };

    const handleCombine = async () => {
        if (!combineTargetTable || !selectedTableForMerge) return;
        setIsCombining(true);
        try {
            const targetOrder = activeOrders.find(o => o.tableNumber === combineTargetTable);
            await api.post('/orders/combine-tables', {
                sourceTable: selectedTableForMerge,
                targetOrderId: targetOrder ? targetOrder._id : null,
                targetTable: combineTargetTable
            });
            Toast.show({ type: 'success', text1: 'Tables Combined' });
            setShowMergeModal(false);
            fetchActiveOrders();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Combine Failed', text2: error.response?.data?.message });
        } finally {
            setIsCombining(false);
        }
    };

    const handleUnmerge = async (tableToUnmerge: string) => {
        const existing = activeOrders.find(o => o.tableNumber === selectedTableForMerge);
        if (!existing) return;

        setIsCombining(true);
        try {
            await api.post(`/orders/${existing._id}/uncombine-table`, {
                tableNumber: tableToUnmerge
            });
            Toast.show({ type: 'success', text1: 'Table Unmerged', text2: `${tableToUnmerge} removed` });
            fetchActiveOrders();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Unmerge Failed', text2: error.response?.data?.message });
        } finally {
            setIsCombining(false);
        }
    };



    const renderTable = ({ item: tableNumber }: { item: string }) => {
        const baseKey = tableNumber.split(' - Set')[0];
        const tableOrders = activeOrders.filter(o => 
            o.tableNumber === baseKey || 
            o.tableNumber.startsWith(`${baseKey} - Set`) ||
            (o.mergedTables && o.mergedTables.split(',').map((t: string) => t.trim()).includes(tableNumber))
        );
        const existingOrder = tableOrders.find(o => o.tableNumber === tableNumber) || tableOrders[0];
        const isOccupied = tableOrders.length > 0;
        const setCount = tableOrders.length;

        // Metadata lookup
        const getTableMeta = (tNum: string) => {
            if (!user?.tableMetadata) return null;
            try {
                const data = typeof user.tableMetadata === 'string' ? JSON.parse(user.tableMetadata) : user.tableMetadata;
                return data[tNum.replace('Table ', '')] || data[tNum.split(' - Set')[0].replace('Table ', '')];
            } catch (e) { return null; }
        };
        const metadata = getTableMeta(baseKey);

        let displayTableName = tableNumber;
        let totalSeats = parseInt(metadata?.seats) || 0;
        
        if (existingOrder?.mergedTables) {
            const merged = existingOrder.mergedTables.split(',').map((t: string) => t.trim());
            const mergedNums = merged.map((t: string) => t.replace('Table ', ''));
            displayTableName = `${tableNumber}, ${mergedNums.join(', ')}`;
            
            merged.forEach((t: string) => {
                const meta = getTableMeta(t);
                if (meta?.seats) totalSeats += parseInt(meta.seats);
            });
        }

        let readyCount = 0;
        let servedCount = 0;
        let totalCount = 0;
        if (existingOrder) {
            totalCount = existingOrder.items.length;
            readyCount = existingOrder.items.filter((i: any) => i.status?.toUpperCase() === 'READY').length;
            servedCount = existingOrder.items.filter((i: any) => i.status?.toUpperCase() === 'SERVED').length;
        }

        const allDone = isOccupied && (readyCount + servedCount) === totalCount;
        const hasReady = readyCount > 0;

        if (!isOccupied) {
            return (
                <TouchableOpacity
                    style={[styles.tableCardList, styles.tableCardEmptyList]}
                    activeOpacity={0.7}
                    onPress={() => handleTablePress(tableNumber)}
                    onLongPress={() => handleLongPressTable(tableNumber)}
                >
                    <View style={styles.tableRowLeft}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="add" size={20} color={colors.textSecondary} />
                        </View>
                        <View>
                            <Text style={styles.tableNumberEmptyList}>{displayTableName}</Text>
                            {metadata && (
                                <Text style={styles.metadataText}>
                                    {totalSeats > 0 ? totalSeats : '?'} Seats • {metadata.location || 'Area'}
                                </Text>
                            )}
                        </View>
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
                onLongPress={() => handleLongPressTable(tableNumber)}
            >
                <LinearGradient
                    colors={['rgba(0,214,143,0.1)', 'rgba(0,168,107,0.02)']}
                    style={StyleSheet.absoluteFill}
                />
                
                {setCount > 1 && (
                    <View style={styles.setCountBadge}>
                        <Text style={styles.setCountText}>{setCount}</Text>
                    </View>
                )}

                <View style={styles.tableHeaderRowList}>
                    <View style={styles.tableRowLeft}>
                        <View>
                            <Text style={styles.tableNumberOccupiedList}>{displayTableName}</Text>
                            {metadata && (
                                <Text style={[styles.metadataText, { color: 'rgba(255,255,255,0.5)' }]}>
                                    {totalSeats > 0 ? totalSeats : '?'} Seats • {metadata.location || 'Area'}
                                </Text>
                            )}
                        </View>
                        {existingOrder?.waiterName && (
                            <View style={styles.waiterBadgeList}>
                                <Ionicons name="person" size={10} color={colors.primary} />
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
                        <Text style={[styles.progressLabel, { color: allDone ? colors.success : colors.textSecondary }]}>
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
                        style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                        onPress={() => {
                            if (existingOrder) {
                                loadOrder(existingOrder);
                            }
                            navigation.navigate('Checkout', { tableNumber });
                        }}
                    >
                        <Ionicons name="receipt-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>View Order</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: allDone ? colors.success : colors.error }]}
                        onPress={() => navigation.navigate('Checkout', { tableNumber, showPayment: true })}
                    >
                        <Ionicons name={allDone ? "wallet-outline" : "close-circle-outline"} size={16} color={colors.white} />
                        <Text style={styles.actionBtnText}>{allDone ? 'Settle Bill' : 'Close Order'}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // Filter tables based on Search and Toggle
    const getFilteredTables = () => {
        const totalTablesCount = user?.totalTables || 10;
        const STANDARD_TABLES = Array.from({ length: totalTablesCount }, (_, i) => `Table ${i + 1}`);
        let baseTables = STANDARD_TABLES;

        // Merge active orders that have custom table names
        const customTables = activeOrders
            .filter(o => !STANDARD_TABLES.includes(o.tableNumber))
            .map(o => o.tableNumber);

        // Ensure uniqueness
        baseTables = Array.from(new Set([...baseTables, ...customTables]));

        // Filter out tables that are merged into another table
        const allMergedTables = activeOrders.reduce((acc, o) => {
            if (o.mergedTables) {
                const merged = o.mergedTables.split(',').map((t: string) => t.trim());
                return [...acc, ...merged];
            }
            return acc;
        }, [] as string[]);
        
        baseTables = baseTables.filter(t => !allMergedTables.includes(t));

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

    // Returns { tableName, badge } array for My Tables view
    const getMyTablesList = () => {
        const rawAssigned = user?.assignedTables || [];
        const assignedNames = rawAssigned.map((t: string) => t.startsWith('Table ') ? t : `Table ${t}`);
        const allMergedTables = activeOrders.reduce((acc: string[], o: any) => {
            if (o.mergedTables) return [...acc, ...o.mergedTables.split(',').map((t: string) => t.trim())];
            return acc;
        }, []);
        const assignedFiltered = assignedNames.filter((t: string) => !allMergedTables.includes(t));
        const tempTables = activeOrders
            .filter((o: any) => (o.createdBy === user?._id || o.waiterName === user?.name) && !assignedNames.includes(o.tableNumber) && !allMergedTables.includes(o.tableNumber))
            .map((o: any) => ({ tableName: o.tableNumber, badge: 'temp' as const }));
        const all = [
            ...assignedFiltered.map((t: string) => ({ tableName: t, badge: 'assigned' as const })),
            ...tempTables,
        ];
        
        // Remove duplicates to prevent React key warnings
        const uniqueAll = Array.from(new Map(all.map(item => [item.tableName, item])).values());
        
        if (searchQuery.trim()) return uniqueAll.filter(t => t.tableName.toLowerCase().includes(searchQuery.toLowerCase()));
        return uniqueAll;
    };

    // Auto-select first occupied table when switching to My Tables
    React.useEffect(() => {
        if (filterMode !== 'my') return;
        const myTs = getMyTablesList();
        if (myTs.length === 0) { setSelectedMyTable(null); return; }
        setSelectedMyTable(prev => {
            if (prev && myTs.some(t => t.tableName === prev)) return prev;
            const firstOcc = myTs.find(t => activeOrders.some((o: any) => o.tableNumber === t.tableName));
            return firstOcc?.tableName || myTs[0]?.tableName || null;
        });
    }, [filterMode, activeOrders]);

    return (
        <LinearGradient colors={gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>Tables</Text>
                        </View>
                        <NotificationBell />
                    </View>

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search table..."
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                {filterMode === 'my' ? (() => {
                    const myTables = getMyTablesList();
                    const selOrder = selectedMyTable ? activeOrders.find((o: any) => o.tableNumber === selectedMyTable) : null;
                    const isOcc = !!selOrder;
                    const allItems: any[] = selOrder?.items || [];
                    const readyCount = allItems.filter(i => i.status?.toUpperCase() === 'READY').length;
                    const servedCount = allItems.filter(i => i.status?.toUpperCase() === 'SERVED').length;
                    const allDone = allItems.length > 0 && (readyCount + servedCount) === allItems.length;
                    const progressPct = allItems.length === 0 ? 0 : ((readyCount + servedCount) / allItems.length) * 100;
                    const orderTotal = allItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                    const getTableMeta = (tNum: string) => {
                        if (!user?.tableMetadata) return null;
                        try {
                            const data = typeof user.tableMetadata === 'string' ? JSON.parse(user.tableMetadata) : user.tableMetadata;
                            return data[tNum.replace('Table ', '')] || null;
                        } catch { return null; }
                    };
                    const meta = selectedMyTable ? getTableMeta(selectedMyTable) : null;

                    return (
                        <View style={styles.myTablesRoot}>
                            {/* ── CHIP ROW ── */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView} contentContainerStyle={styles.chipScrollContent}>
                                {myTables.length === 0 ? (
                                    <View style={styles.noTablesHintWrap}>
                                        <Ionicons name="alert-circle-outline" size={16} color={colors.textMuted} />
                                        <Text style={styles.noTablesHint}>No tables assigned. Contact manager.</Text>
                                    </View>
                                ) : myTables.map(({ tableName, badge }) => {
                                    const isActive = selectedMyTable === tableName;
                                    const chipOcc = activeOrders.some((o: any) => o.tableNumber === tableName);
                                    return (
                                        <TouchableOpacity
                                            key={tableName}
                                            style={[styles.tableChip, isActive && styles.tableChipActive, !isActive && chipOcc && styles.tableChipOccupied]}
                                            onPress={() => setSelectedMyTable(tableName)}
                                            activeOpacity={0.75}
                                        >
                                            {chipOcc && <View style={[styles.chipDot, isActive && { backgroundColor: '#000' }]} />}
                                            <Text style={[styles.tableChipText, isActive && styles.tableChipTextActive]} numberOfLines={1}>
                                                {tableName}
                                            </Text>
                                            {badge === 'temp' && (
                                                <View style={styles.chipTempTag}><Text style={styles.chipTempText}>TEMP</Text></View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* ── DETAIL CARD ── */}
                            {!selectedMyTable || myTables.length === 0 ? (
                                <View style={styles.detailPlaceholder}>
                                    <Ionicons name="restaurant-outline" size={52} color={colors.textMuted} style={{ opacity: 0.25 }} />
                                    <Text style={styles.placeholderText}>Select a table above</Text>
                                </View>
                            ) : (
                                <ScrollView style={styles.detailCard} contentContainerStyle={styles.detailCardContent} showsVerticalScrollIndicator={false}>
                                    {/* Header row */}
                                    <View style={styles.detailHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.detailTableName}>{selectedMyTable}</Text>
                                            {meta && <Text style={styles.detailMeta}>{meta.seats ? `${meta.seats} Seats` : '?'}{meta.location ? ` • ${meta.location}` : ''}</Text>}
                                        </View>
                                        {isOcc ? (
                                            <View style={styles.activeStatusBadge}>
                                                <View style={styles.activeDot} />
                                                <Text style={styles.activeStatusText}>Active</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.availableStatusBadge}>
                                                <Text style={styles.availableStatusText}>Available</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Waiter + item count */}
                                    {selOrder?.waiterName && (
                                        <View style={styles.detailWaiterRow}>
                                            <Ionicons name="person" size={13} color={colors.primary} />
                                            <Text style={styles.detailWaiterText}>{selOrder.waiterName}</Text>
                                            <Text style={styles.detailItemCount}>• {allItems.length} items</Text>
                                        </View>
                                    )}

                                    {/* Progress bar */}
                                    {isOcc && allItems.length > 0 && (
                                        <View style={styles.detailProgressSection}>
                                            <View style={styles.detailProgressLabelRow}>
                                                <Text style={styles.detailProgressLabel}>Kitchen Status</Text>
                                                <Text style={[styles.detailProgressLabel, { color: allDone ? colors.success : colors.warning || '#FFB300' }]}>
                                                    {readyCount + servedCount}/{allItems.length} Done
                                                </Text>
                                            </View>
                                            <View style={styles.detailProgressBg}>
                                                <LinearGradient
                                                    colors={allDone ? ['#00C853', '#009624'] : ['#FFD54F', '#FFB300']}
                                                    style={[styles.detailProgressFill, { width: `${progressPct}%` as any }]}
                                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                />
                                            </View>
                                        </View>
                                    )}

                                    {/* Items list */}
                                    {isOcc ? (
                                        <View style={styles.itemsList}>
                                            {allItems.map((item: any, idx: number) => {
                                                const st = item.status?.toUpperCase() || 'PENDING';
                                                const stColor = (st === 'READY' || st === 'SERVED') ? colors.success : colors.textMuted;
                                                const stIcon: any = st === 'READY' ? 'checkmark-circle' : st === 'SERVED' ? 'checkmark-done-circle' : 'time-outline';
                                                return (
                                                    <View key={idx} style={styles.detailItemRow}>
                                                        <Ionicons name={stIcon} size={15} color={stColor} />
                                                        <Text style={styles.detailItemName} numberOfLines={1}>{item.name}</Text>
                                                        <Text style={styles.detailItemQty}>×{item.quantity}</Text>
                                                        <Text style={styles.detailItemPrice}>₹{(item.price * item.quantity).toFixed(0)}</Text>
                                                    </View>
                                                );
                                            })}
                                            <View style={styles.detailTotalRow}>
                                                <Text style={styles.detailTotalLabel}>Order Total</Text>
                                                <Text style={styles.detailTotalValue}>₹{orderTotal.toFixed(2)}</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.emptyTableInfo}>
                                            <Ionicons name="cafe-outline" size={36} color={colors.textMuted} style={{ opacity: 0.3, marginBottom: 8 }} />
                                            <Text style={styles.emptyTableText}>No active order on this table.</Text>
                                            <Text style={styles.emptyTableSub}>Tap below to start a new order.</Text>
                                        </View>
                                    )}

                                    {/* Edit Order */}
                                    {isOcc && (
                                        <TouchableOpacity
                                            style={styles.editOrderBtn}
                                            onPress={() => { if (selOrder) loadOrder(selOrder); navigation.navigate('Order'); }}
                                        >
                                            <Ionicons name="create-outline" size={16} color={colors.primary} />
                                            <Text style={styles.editOrderText}>Edit / Add to Order</Text>
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                            )}

                            {/* ── BOTTOM ACTION BUTTON ── */}
                            <View style={styles.bottomActionContainer}>
                                {selectedMyTable && isOcc ? (
                                    <TouchableOpacity
                                        style={[styles.bottomActionBtn, { backgroundColor: allDone ? colors.success : colors.error }]}
                                        onPress={() => { if (selOrder) loadOrder(selOrder); navigation.navigate('Checkout', { tableNumber: selectedMyTable, showPayment: allDone }); }}
                                    >
                                        <Ionicons name={allDone ? 'wallet-outline' : 'close-circle-outline'} size={20} color="#fff" />
                                        <Text style={styles.bottomActionText}>{allDone ? 'SETTLE BILL' : 'CLOSE ORDER'}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.bottomActionBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => selectedMyTable && handleTablePress(selectedMyTable)}
                                        disabled={!selectedMyTable}
                                    >
                                        <Ionicons name="add-circle-outline" size={20} color="#000" />
                                        <Text style={[styles.bottomActionText, { color: '#000' }]}>START NEW ORDER</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })() : (
                    isLoading && activeOrders.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={getFilteredTables()}
                            keyExtractor={(item) => item}
                            renderItem={renderTable}
                            contentContainerStyle={styles.listContentList}
                            showsVerticalScrollIndicator={false}
                            refreshing={isRefreshing}
                            onRefresh={() => { setIsRefreshing(true); fetchActiveOrders(); }}
                            ListFooterComponent={
                                (user?.role === 'owner' || user?.role === 'manager') ? (
                                    <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('OrderHistory')}>
                                        <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                                        <Text style={styles.historyBtnText}>View Order History</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )
                )}

            </SafeAreaView>

            {/* Combine Modal */}
            <Modal visible={showMergeModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manage Table Merge</Text>
                            <TouchableOpacity onPress={() => setShowMergeModal(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select target table for {selectedTableForMerge}</Text>

                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {(() => {
                                const currentOrder = activeOrders.find(o => o.tableNumber === selectedTableForMerge);
                                if (currentOrder?.mergedTables) {
                                    const merged = currentOrder.mergedTables.split(',').map((t: string) => t.trim());
                                    return (
                                        <View style={styles.currentMergesContainer}>
                                            <Text style={styles.mergeSectionTitle}>🔗 Currently Combined</Text>
                                            <View style={styles.mergePillRow}>
                                                {merged.map((t: string) => (
                                                    <View key={t} style={styles.mergePill}>
                                                        <Text style={styles.mergePillText}>{t}</Text>
                                                        <TouchableOpacity 
                                                            style={styles.unmergePillBtn} 
                                                            onPress={() => handleUnmerge(t)}
                                                            disabled={isCombining}
                                                        >
                                                            <Ionicons name="close-circle" size={18} color={colors.error} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>
                                            <View style={styles.mergeDivider} />
                                        </View>
                                    );
                                }
                                return null;
                            })()}

                            <Text style={styles.mergeSectionTitle}>Select Target Table</Text>
                            <View style={styles.tableSelectionGrid}>
                                {Array.from({ length: user?.totalTables || 10 }, (_, i) => i + 1).map(num => {
                                    const key = `Table ${num}`;
                                    if (key === selectedTableForMerge) return null;
                                    
                                    // Don't show already merged tables as selection targets
                                    const currentOrder = activeOrders.find(o => o.tableNumber === selectedTableForMerge);
                                    if (currentOrder?.mergedTables?.includes(key)) return null;
                                    
                                    // Also don't show tables that are merged into something else entirely
                                    const allMergedTables = activeOrders.reduce((acc, o) => {
                                        if (o.mergedTables) {
                                            const merged = o.mergedTables.split(',').map((t: string) => t.trim());
                                            return [...acc, ...merged];
                                        }
                                        return acc;
                                    }, [] as string[]);
                                    if (allMergedTables.includes(key)) return null;

                                    const isOccupied = activeOrders.some(o => 
                                        o.tableNumber === key || 
                                        o.tableNumber.startsWith(`${key} - Set`) ||
                                        (o.mergedTables && o.mergedTables.split(',').map((t: string) => t.trim()).includes(key))
                                    );
                                    const isSelected = combineTargetTable === key;

                                    return (
                                        <TouchableOpacity
                                            key={num}
                                            style={[
                                                styles.tableChoice,
                                                isOccupied && styles.tableChoiceOccupied,
                                                isSelected && styles.tableChoiceSelected
                                            ]}
                                            onPress={() => setCombineTargetTable(key)}
                                        >
                                            <Text style={[styles.tableChoiceNum, isSelected && { color: colors.white }]}>{num}</Text>
                                            {isOccupied && <View style={styles.occupiedDot} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.modalActionBtn, !combineTargetTable && { opacity: 0.5 }]}
                            disabled={isCombining || !combineTargetTable}
                            onPress={handleCombine}
                        >
                            <LinearGradient colors={gradients.primary} style={styles.modalActionGradient}>
                                {isCombining ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalActionText}>Confirm Combine</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    headerTitle: { ...Typography.h2, color: colors.white, fontWeight: '800' },
    searchContainer: { 
        flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md,
        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 
        borderRadius: Radius.round, paddingHorizontal: 12, height: 44, 
        borderWidth: 1, borderColor: colors.border 
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: colors.textPrimary, ...Typography.body2 },
    tabContainer: { 
        flexDirection: 'row', 
        backgroundColor: colors.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', 
        borderRadius: Radius.round, padding: 4, marginTop: Spacing.md 
    },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.round },
    tabBtnActive: { backgroundColor: colors.primary },
    tabText: { ...Typography.buttonSm, color: colors.textMuted },
    tabTextActive: { color: '#000000', fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // List Layout Cards
    listContentList: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm },
    tableCardList: { marginBottom: Spacing.md, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, padding: Spacing.lg },
    tableCardEmptyList: { 
        backgroundColor: colors.surface, 
        borderColor: colors.border, 
        borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
    },
    tableRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center' },
    tableNumberEmptyList: { ...Typography.h4, color: colors.textSecondary },
    tableEmptyTextList: { ...Typography.body2, color: colors.textMuted, fontWeight: '600' },

    tableCardOccupiedList: { 
        backgroundColor: colors.card, 
        borderColor: colors.success + '4D', // 30% opacity
        shadowColor: colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 
    },
    tableHeaderRowList: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    tableNumberOccupiedList: { ...Typography.h3, color: colors.textPrimary, fontWeight: '800' },
    waiterBadgeList: { 
        flexDirection: 'row', alignItems: 'center', gap: 4, 
        backgroundColor: colors.primary + '26', // 15% opacity
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm 
    },
    waiterNameTextList: { ...Typography.caption, color: colors.primary, fontWeight: '600' },
    tableTotalTextList: { ...Typography.h4, color: colors.textPrimary, fontWeight: '700' },
    tableTimeTextList: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    settleBtnMini: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.round },
    settleBtnMiniText: { ...Typography.buttonSm, color: '#000000', fontSize: 12 },

    // Progress Bar
    progressContainer: { marginTop: Spacing.xs },
    progressLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { ...Typography.caption, color: colors.textSecondary, fontSize: 11 },
    progressBarBg: { height: 6, backgroundColor: colors.glass, borderRadius: Radius.round, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: Radius.round },

    // Action Row
    tableActionRow: { 
        flexDirection: 'row', gap: 10, marginTop: Spacing.lg, paddingTop: Spacing.md, 
        borderTopWidth: 1, borderTopColor: colors.border 
    },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md },
    actionBtnText: { ...Typography.buttonSm, color: '#000000', fontWeight: '600' },

    // History Button
    historyBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: Spacing.xl, marginBottom: Spacing.xl,
        paddingVertical: 16, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    historyBtnText: { ...Typography.button, color: colors.textSecondary, fontWeight: '600' },
    metadataText: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
    setCountBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: colors.primary,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 2,
        borderColor: colors.card,
    },
    setCountText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: '900',
    },
    // Merge Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
    modalTitle: { ...Typography.h3, color: colors.textPrimary },
    modalSubtitle: { ...Typography.body2, color: colors.textSecondary, marginBottom: Spacing.md },
    tableSelectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 10 },
    tableChoice: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.glass, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    tableChoiceOccupied: { borderColor: colors.success + '4D' },
    tableChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    tableChoiceNum: { ...Typography.h4, color: colors.textSecondary },
    occupiedDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    modalActionBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: 20 },
    modalActionGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    modalActionText: { ...Typography.h5, color: '#000000', fontWeight: '700' },
    currentMergesContainer: { marginBottom: Spacing.md },
    mergeSectionTitle: { ...Typography.caption, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
    mergePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    mergePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '33' },
    mergePillText: { ...Typography.buttonSm, color: colors.primary, fontWeight: '700' },
    unmergePillBtn: { padding: 2 },
    mergeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10, opacity: 0.5 },

    // ── MY TABLES VIEW ──────────────────────────────────────────────────────
    myTablesRoot: { flex: 1, flexDirection: 'column' },

    // Chip scroll row
    chipScrollView: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
    chipScrollContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 10, flexDirection: 'row', alignItems: 'center' },
    noTablesHintWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    noTablesHint: { ...Typography.body2, color: colors.textMuted, fontStyle: 'italic' },
    tableChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: Radius.round, borderWidth: 1.5,
        borderColor: colors.border, backgroundColor: colors.surface,
    },
    tableChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tableChipOccupied: { borderColor: colors.success + '80', backgroundColor: colors.success + '15' },
    chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    tableChipText: { ...Typography.buttonSm, color: colors.textSecondary, fontWeight: '700' },
    tableChipTextActive: { color: '#000000' },
    chipTempTag: { backgroundColor: '#FF980020', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    chipTempText: { fontSize: 9, fontWeight: '800', color: '#FF9800', letterSpacing: 0.5 },

    // Detail card
    detailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
    placeholderText: { ...Typography.body1, color: colors.textMuted, opacity: 0.5 },
    detailCard: { flex: 1, marginHorizontal: Spacing.lg, marginTop: Spacing.md },
    detailCardContent: { paddingBottom: Spacing.xl },
    detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.sm },
    detailTableName: { ...Typography.h2, color: colors.textPrimary, fontWeight: '800' },
    detailMeta: { ...Typography.caption, color: colors.textSecondary, marginTop: 3 },
    activeStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.success + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.round },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    activeStatusText: { ...Typography.caption, color: colors.success, fontWeight: '700' },
    availableStatusBadge: { backgroundColor: colors.glass, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.round },
    availableStatusText: { ...Typography.caption, color: colors.textMuted, fontWeight: '600' },
    detailWaiterRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.md },
    detailWaiterText: { ...Typography.body2, color: colors.primary, fontWeight: '700' },
    detailItemCount: { ...Typography.body2, color: colors.textMuted },
    detailProgressSection: { marginBottom: Spacing.md },
    detailProgressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    detailProgressLabel: { ...Typography.caption, color: colors.textSecondary },
    detailProgressBg: { height: 6, backgroundColor: colors.glass, borderRadius: Radius.round, overflow: 'hidden' },
    detailProgressFill: { height: '100%', borderRadius: Radius.round },
    itemsList: { borderRadius: Radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: Spacing.md },
    detailItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailItemName: { flex: 1, ...Typography.body2, color: colors.textPrimary, fontWeight: '600' },
    detailItemQty: { ...Typography.body2, color: colors.textMuted, fontWeight: '700', minWidth: 28, textAlign: 'center' },
    detailItemPrice: { ...Typography.body2, color: colors.textSecondary, fontWeight: '700', minWidth: 50, textAlign: 'right' },
    detailTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, backgroundColor: colors.glass },
    detailTotalLabel: { ...Typography.body2, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailTotalValue: { ...Typography.h4, color: colors.primary, fontWeight: '800' },
    emptyTableInfo: { alignItems: 'center', paddingVertical: Spacing.xxl || 40, gap: 6 },
    emptyTableText: { ...Typography.body1, color: colors.textSecondary, fontWeight: '600' },
    emptyTableSub: { ...Typography.body2, color: colors.textMuted },
    editOrderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: colors.primary + '60', backgroundColor: colors.primary + '10', marginBottom: Spacing.sm },
    editOrderText: { ...Typography.button, color: colors.primary, fontWeight: '700' },

    // Bottom action button
    bottomActionContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 110, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface + 'FA' },
    bottomActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: Radius.lg },
    bottomActionText: { ...Typography.h5, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
});
