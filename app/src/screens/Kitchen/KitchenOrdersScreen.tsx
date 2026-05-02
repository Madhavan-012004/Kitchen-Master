import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import api from '../../api/client';
import { useSocket } from '../../hooks/useSocket';
import { NotificationBell } from '../../components/NotificationBell';
import Toast from 'react-native-toast-message';

export default function KitchenOrdersScreen() {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [serverStatus, setServerStatus] = useState<'checking' | 'up' | 'down' | null>(null);

    const checkConnection = async () => {
        setServerStatus('checking');
        try {
            await api.get('/status');
            setServerStatus('up');
            Toast.show({ type: 'success', text1: 'Server Connected', text2: 'Backend is reachable!' });
            fetchOrders();
        } catch (e) {
            setServerStatus('down');
            Toast.show({ type: 'error', text1: 'Connection Failed', text2: 'Please check your IP settings.' });
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await api.get('/orders?paymentStatus=unpaid&limit=50');
            const sorted = (response.data.data.orders || []).sort(
                (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            setOrders(sorted);
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message;
            const baseUrl = error.config?.baseURL || 'unknown';
            console.error('Failed to fetch kitchen orders', errorMsg, 'at', baseUrl);
            if (isLoading) {
                Alert.alert(
                    'Network Error',
                    `Could not reach server at ${baseUrl}\n\nError: ${errorMsg}\n\nPlease check your Server IP in Settings.`
                );
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const socket = useSocket();

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('kot:new', (data: any) => {
            if (!data.order) return;
            setOrders(prev => {
                if (prev.find(o => o._id === data.order._id)) return prev;
                const newOrders = [...prev, data.order];
                return newOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
        });

        socket.on('kot:update', (data: any) => {
            if (!data.order) return;
            setOrders(prev => {
                const index = prev.findIndex(o => o._id === data.order._id);
                if (index === -1) {
                    const newOrders = [...prev, data.order];
                    return newOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                }
                const updated = [...prev];
                updated[index] = data.order;
                return updated;
            });
        });

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

        socket.on('kot:statusUpdate', (data: any) => {
            if (data.status === 'paid' || data.status === 'cancelled') {
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

            setOrders(prevOrders =>
                prevOrders.map(order => {
                    if (order._id === orderId) {
                        const updatedItems = order.items.map((item: any) =>
                            item._id === itemId ? { ...item, status: 'ready' } : item
                        );
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

    const askExtraTime = async (orderId: string) => {
        try {
            await api.patch(`/orders/${orderId}/notes`, { notes: `⏳ Kitchen needs 10 more mins.` });
            Toast.show({ type: 'success', text1: 'Notification Sent', text2: 'Staff informed about the 10min delay.' });
            fetchOrders();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Failed', text2: error.response?.data?.message || 'Could not send notification' });
        }
    };

    const renderOrderItem = ({ item }: { item: any }) => {
        const groupByName = (arr: any[]) => {
            const map: Record<string, any> = {};
            arr.forEach(foodItem => {
                const key = foodItem.name.toLowerCase();
                if (map[key]) {
                    map[key] = { ...map[key], quantity: map[key].quantity + foodItem.quantity };
                } else {
                    map[key] = { ...foodItem };
                }
            });
            return Object.values(map);
        };

        const rawWaiting = item.items.filter((f: any) => 
            f.status !== 'served' && f.status !== 'SERVED' && 
            f.status !== 'ready' && f.status !== 'READY' &&
            f.status !== 'cancelled' && f.status !== 'CANCELLED'
        );
        const rawCompleted = item.items.filter((f: any) => f.status === 'ready' || f.status === 'READY');
        const waitingGroups = groupByName(rawWaiting);
        const completedGroups = groupByName(rawCompleted);
        const allServed = rawWaiting.length === 0 && rawCompleted.length === 0;

        return (
            <View style={themedStyles.orderCard}>
                <View style={themedStyles.cardHeader}>
                    <View style={themedStyles.headerLeft}>
                        <View style={themedStyles.tableBadge}>
                            <Ionicons name="restaurant" size={16} color={colors.white} />
                            <Text style={themedStyles.tableText}>{item.tableNumber}</Text>
                        </View>
                        {item.waiterName && (
                            <View style={themedStyles.waiterBadge}>
                                <Ionicons name="person" size={12} color={colors.primary} />
                                <Text style={themedStyles.waiterNameText}>{item.waiterName}</Text>
                            </View>
                        )}
                        <Text style={themedStyles.orderTime}>{formatTime(item.createdAt)}</Text>
                    </View>
                    <View style={themedStyles.waitTimeBadge}>
                        <Ionicons name="time-outline" size={14} color={colors.warning} />
                        <Text style={themedStyles.waitTimeText}>{getWaitTime(item.createdAt)}</Text>
                    </View>
                </View>

                {item.notes ? (
                    <View style={themedStyles.notesContainer}>
                        <Ionicons name="warning" size={16} color={colors.primary} />
                        <Text style={themedStyles.notesText}>{item.notes}</Text>
                    </View>
                ) : null}

                {allServed ? (
                    <View style={themedStyles.allServedContainer}>
                        <Ionicons name="checkmark-done-circle" size={24} color={colors.success} style={{ marginBottom: 4 }} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>All items served.</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Waiting for Bill Settlement.</Text>
                    </View>
                ) : (
                    <View style={themedStyles.itemsList}>
                        {waitingGroups.map((foodItem: any, index: number) => (
                            <View key={`w-${foodItem.name}-${index}`} style={themedStyles.foodRow}>
                                <View style={themedStyles.foodRowContent}>
                                    <Text style={themedStyles.foodQty}>{foodItem.quantity}x</Text>
                                    <View style={themedStyles.foodDetails}>
                                        <Text style={themedStyles.foodName}>{foodItem.name}</Text>
                                        {foodItem.notes ? <Text style={themedStyles.itemNotesText}>Note: {foodItem.notes}</Text> : null}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={themedStyles.itemReadyBtn}
                                    onPress={() => markItemAsReady(item._id, foodItem._id)}
                                >
                                    <Ionicons name="checkmark" size={18} color={colors.white} />
                                    <Text style={themedStyles.itemReadyText}>Ready</Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        {completedGroups.length > 0 && (
                            <>
                                <View style={themedStyles.completedDivider}>
                                    <View style={themedStyles.completedDividerLine} />
                                    <Text style={themedStyles.completedDividerLabel}>Completed</Text>
                                    <View style={themedStyles.completedDividerLine} />
                                </View>
                                {completedGroups.map((foodItem: any, index: number) => (
                                    <View key={`c-${foodItem.name}-${index}`} style={[themedStyles.foodRow, { opacity: 0.65 }]}>
                                        <View style={themedStyles.foodRowContent}>
                                            <Text style={[themedStyles.foodQty, themedStyles.textStrikethrough]}>{foodItem.quantity}x</Text>
                                            <View style={themedStyles.foodDetails}>
                                                <Text style={[themedStyles.foodName, themedStyles.textStrikethrough]}>{foodItem.name}</Text>
                                            </View>
                                        </View>
                                        <View style={themedStyles.itemDoneBadge}>
                                            <Ionicons name="checkmark-done" size={16} color={colors.success} />
                                            <Text style={themedStyles.itemDoneText}>Ready</Text>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}

                {!allServed && (
                    <TouchableOpacity 
                        style={themedStyles.extraTimeBtn}
                        onPress={() => askExtraTime(item._id)}
                    >
                        <Ionicons name="time-outline" size={18} color={colors.warning} />
                        <Text style={themedStyles.extraTimeBtnText}>⏱️ Extra 10 Mins</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                <View style={themedStyles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={themedStyles.headerTitle}>Kitchen Display</Text>
                        <Text style={themedStyles.headerSubtitle}>Active Orders (KOT)</Text>
                    </View>
                    <NotificationBell />
                    <TouchableOpacity 
                        style={[themedStyles.refreshBtn, { marginRight: 10, borderColor: serverStatus === 'up' ? colors.success : serverStatus === 'down' ? colors.error : colors.border }]} 
                        onPress={checkConnection}
                    >
                        <Ionicons 
                            name={serverStatus === 'up' ? 'checkmark-circle' : serverStatus === 'down' ? 'alert-circle' : 'pulse-outline'} 
                            size={20} 
                            color={serverStatus === 'up' ? colors.success : serverStatus === 'down' ? colors.error : colors.primary} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={themedStyles.refreshBtn} onPress={() => { setIsRefreshing(true); fetchOrders(); }}>
                        <Ionicons name="reload" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {isLoading && orders.length === 0 ? (
                    <View style={themedStyles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={themedStyles.loadingText}>Loading tickets...</Text>
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
                            fetchOrders();
                        }}
                        ListEmptyComponent={
                            <View style={themedStyles.emptyWrap}>
                                <Ionicons name="checkmark-done-circle-outline" size={60} color={colors.success} />
                                <Text style={themedStyles.emptyText}>All caught up!</Text>
                                <Text style={themedStyles.emptySubtext}>No active orders to prepare.</Text>
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
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    headerTitle: { ...Typography.h2, color: colors.textPrimary },
    headerSubtitle: { ...Typography.body2, color: colors.textMuted, marginTop: 4 },
    refreshBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '1A',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '33'
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { ...Typography.body2, color: colors.textMuted },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 120 },
    emptyText: { ...Typography.h4, color: colors.textPrimary },
    emptySubtext: { ...Typography.body2, color: colors.textMuted },

    orderCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: colors.border,
        padding: Spacing.lg, marginBottom: Spacing.lg,
        ...Shadows.sm
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tableBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: Radius.md
    },
    tableText: { ...Typography.buttonSm, color: colors.white },
    waiterBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '26', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
    waiterNameText: { ...Typography.caption, color: colors.primary, fontWeight: '600' },
    orderTime: { ...Typography.caption, color: colors.textMuted },
    waitTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '1A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
    waitTimeText: { ...Typography.caption, color: colors.warning, fontWeight: '700' },

    notesContainer: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: colors.primary + '14', padding: Spacing.md,
        borderRadius: Radius.md, marginBottom: Spacing.md,
        borderLeftWidth: 3, borderLeftColor: colors.primary
    },
    notesText: { ...Typography.body2, color: colors.textPrimary, flex: 1 },

    itemsList: { marginBottom: Spacing.sm },
    foodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    foodRowContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    foodQty: { ...Typography.h5, color: colors.primary, width: 32 },
    foodDetails: { flex: 1 },
    foodName: { ...Typography.h5, color: colors.textPrimary },
    itemNotesText: { ...Typography.caption, color: colors.warning, marginTop: 2, fontStyle: 'italic' },
    textStrikethrough: { textDecorationLine: 'line-through', color: colors.textMuted },

    itemReadyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '26', borderWidth: 1, borderColor: colors.success + '4D', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md },
    itemReadyText: { ...Typography.buttonSm, color: colors.success },
    itemDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
    itemDoneText: { ...Typography.caption, color: colors.success, fontWeight: 'bold' },

    completedDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: Spacing.sm },
    completedDividerLine: { flex: 1, height: 1, backgroundColor: colors.success + '33' },
    completedDividerLabel: { fontSize: 10, fontWeight: '700', color: colors.success, textTransform: 'uppercase', letterSpacing: 1 },
    allServedContainer: { padding: 12, alignItems: 'center', backgroundColor: colors.glass, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    extraTimeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 15, paddingVertical: 12, borderRadius: 10,
        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderWidth: 1, borderColor: colors.border,
    },
    extraTimeBtnText: {
        fontSize: 12, color: colors.warning, fontWeight: '700'
    },
});
