import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import api from '../../api/client';
import { useSocket } from '../../hooks/useSocket';

export default function KitchenOrdersScreen() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchOrders = async () => {
        try {
            // Fetch ALL unpaid orders so tickets never disappear until billing is complete
            const response = await api.get('/orders?paymentStatus=unpaid&limit=50');
            // Sort oldest first for kitchen
            const sorted = (response.data.data.orders || []).sort(
                (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setOrders(sorted);
        } catch (error) {
            console.error('Failed to fetch kitchen orders', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const socket = useSocket();

    useEffect(() => {
        fetchOrders();
        // Fallback: Set up a polling interval for the kitchen display (e.g. every 10 seconds)
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    // Socket.io Real-time listeners
    useEffect(() => {
        if (!socket) return;

        // 1. New Order received
        socket.on('kot:new', (data: any) => {
            if (!data.order) return;
            setOrders(prev => {
                // Prevent duplicates if polling already caught it
                if (prev.find(o => o._id === data.order._id)) return prev;
                const newOrders = [...prev, data.order];
                return newOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
        });

        // 2. Existing Order updated (Add-ons)
        socket.on('kot:update', (data: any) => {
            if (!data.order) return;
            setOrders(prev => {
                const index = prev.findIndex(o => o._id === data.order._id);
                if (index === -1) {
                    // If not found (maybe it was settled but now unpaid add-on?), add it
                    const newOrders = [...prev, data.order];
                    return newOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                }
                const updated = [...prev];
                updated[index] = data.order;
                return updated;
            });
        });

        // 3. Item status update (Ready/Served)
        socket.on('kot:itemUpdate', (data: any) => {
            setOrders(prev => prev.map(order => {
                if (order._id === data.orderId) {
                    const updatedItems = order.items.map((item: any) =>
                        item._id === data.itemId ? { ...item, status: data.status } : item
                    );
                    return { ...order, items: updatedItems, status: data.orderStatus };
                }
                return order;
            }));
        });

        // 4. Order status update (Paid/Cancelled)
        socket.on('kot:statusUpdate', (data: any) => {
            if (data.status === 'paid' || data.status === 'cancelled') {
                // Remove from kitchen display
                setOrders(prev => prev.filter(o => o._id !== data.orderId));
            }
        });

        return () => {
            socket.off('kot:new');
            socket.off('kot:update');
            socket.off('kot:itemUpdate');
            socket.off('kot:statusUpdate');
        };
    }, [socket]);

    const markItemAsReady = async (orderId: string, itemId: string) => {
        try {
            await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status: 'ready' });

            // Optimistically update the UI
            setOrders(prevOrders =>
                prevOrders.map(order => {
                    if (order._id === orderId) {
                        const updatedItems = order.items.map((item: any) =>
                            item._id === itemId ? { ...item, status: 'ready' } : item
                        );
                        // We NO LONGER REMOVE the order from the array here, because we want it to stay until checkout!
                        return { ...order, items: updatedItems };
                    }
                    return order;
                })
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to update item status');
            fetchOrders();
        }
    };

    const formatTime = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const getWaitTime = (dateString: string) => {
        const start = new Date(dateString).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        if (diffMins < 5) return 'Just now';
        return `${diffMins} min ago`;
    };

    const renderOrderItem = ({ item }: { item: any }) => {
        // Only show items that are 'preparing' or 'pending' or 'ready'. Hide 'served' completely.
        const visibleItems = item.items.filter((foodItem: any) => foodItem.status !== 'served');


        return (
            <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View style={styles.tableBadge}>
                            <Ionicons name="restaurant" size={16} color={Colors.white} />
                            <Text style={styles.tableText}>{item.tableNumber}</Text>
                        </View>
                        {item.waiterName && (
                            <View style={styles.waiterBadge}>
                                <Ionicons name="person" size={12} color={Colors.primary} />
                                <Text style={styles.waiterNameText}>{item.waiterName}</Text>
                            </View>
                        )}
                        <Text style={styles.orderTime}>{formatTime(item.createdAt)}</Text>
                    </View>
                    <View style={styles.waitTimeBadge}>
                        <Ionicons name="time-outline" size={14} color={Colors.warning} />
                        <Text style={styles.waitTimeText}>{getWaitTime(item.createdAt)}</Text>
                    </View>
                </View>

                {item.notes ? (
                    <View style={styles.notesContainer}>
                        <Ionicons name="warning" size={16} color="#FF6B35" />
                        <Text style={styles.notesText}>{item.notes}</Text>
                    </View>
                ) : null}

                {visibleItems.length === 0 ? (
                    <View style={{ padding: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <Ionicons name="checkmark-done-circle" size={24} color={Colors.success} style={{ marginBottom: 4 }} />
                        <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>All items served.</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Waiting for Bill Settlement.</Text>
                    </View>
                ) : (
                    <View style={styles.itemsList}>
                        {visibleItems.map((foodItem: any, index: number) => {
                            const isReady = foodItem.status === 'ready';
                            return (
                                <View key={foodItem._id || index} style={styles.foodRow}>
                                    <View style={styles.foodRowContent}>
                                        <Text style={[styles.foodQty, isReady && styles.textStrikethrough]}>{foodItem.quantity}x</Text>
                                        <View style={styles.foodDetails}>
                                            <Text style={[styles.foodName, isReady && styles.textStrikethrough]}>{foodItem.name}</Text>
                                            {foodItem.notes ? <Text style={styles.itemNotesText}>Note: {foodItem.notes}</Text> : null}
                                        </View>
                                    </View>

                                    {!isReady ? (
                                        <TouchableOpacity
                                            style={styles.itemReadyBtn}
                                            onPress={() => markItemAsReady(item._id, foodItem._id)}
                                        >
                                            <Ionicons name="checkmark" size={18} color={Colors.white} />
                                            <Text style={styles.itemReadyText}>Ready</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.itemDoneBadge}>
                                            <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                                            <Text style={styles.itemDoneText}>Ready</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Kitchen Display</Text>
                        <Text style={styles.headerSubtitle}>Active Orders (KOT)</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={() => { setIsRefreshing(true); fetchOrders(); }}>
                        <Ionicons name="reload" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                {isLoading && orders.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Loading tickets...</Text>
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
                            fetchOrders();
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyWrap}>
                                <Ionicons name="checkmark-done-circle-outline" size={60} color={Colors.success} />
                                <Text style={styles.emptyText}>All caught up!</Text>
                                <Text style={styles.emptySubtext}>No active orders to prepare.</Text>
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
    headerTitle: { ...Typography.h2, color: Colors.textPrimary },
    headerSubtitle: { ...Typography.body2, color: Colors.textMuted, marginTop: 4 },
    refreshBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,107,53,0.1)',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)'
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { ...Typography.body2, color: Colors.textMuted },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 120 },
    emptyText: { ...Typography.h4, color: Colors.textPrimary },
    emptySubtext: { ...Typography.body2, color: Colors.textMuted },

    orderCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.glassBorder,
        padding: Spacing.lg, marginBottom: Spacing.lg,
        ...Shadows.sm
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tableBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: Radius.md
    },
    tableText: { ...Typography.buttonSm, color: Colors.white },
    waiterBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,53,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
    waiterNameText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
    orderTime: { ...Typography.caption, color: Colors.textMuted },
    waitTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,183,77,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
    waitTimeText: { ...Typography.caption, color: Colors.warning, fontWeight: '700' },

    notesContainer: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: 'rgba(255,107,53,0.08)', padding: Spacing.md,
        borderRadius: Radius.md, marginBottom: Spacing.md,
        borderLeftWidth: 3, borderLeftColor: '#FF6B35'
    },
    notesText: { ...Typography.body2, color: Colors.textPrimary, flex: 1 },

    itemsList: { marginBottom: Spacing.sm },
    foodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
    foodRowContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    foodQty: { ...Typography.h5, color: Colors.primary, width: 32 },
    foodDetails: { flex: 1 },
    foodName: { ...Typography.h5, color: Colors.white },
    itemNotesText: { ...Typography.caption, color: Colors.warning, marginTop: 2, fontStyle: 'italic' },
    textStrikethrough: { textDecorationLine: 'line-through', color: Colors.textMuted },

    itemReadyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 214, 143, 0.15)', borderWidth: 1, borderColor: 'rgba(0, 214, 143, 0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md },
    itemReadyText: { ...Typography.buttonSm, color: '#00D68F' },
    itemDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
    itemDoneText: { ...Typography.caption, color: Colors.success, fontWeight: 'bold' },
});
