import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';
import apiClient from '../../api/client';

const { width } = Dimensions.get('window');

interface DashboardStats {
    totalCompleted: number;
    averageRating: number;
    recentReviews: Array<{
        rating: number;
        feedback: string;
        orderNumber: string;
        createdAt: string;
    }>;
    history: Array<{
        id: number;
        orderNumber: string;
        amount: number;
        items: number;
        createdAt: string;
    }>;
    activeOrders: Array<{
        id: number;
        orderNumber: string;
        tableNumber: string;
        createdAt: string;
        items: any[];
    }>;
}

export default function WaitersDashboardScreen({ navigation }: any) {
    const { colors, isDark } = useAppTheme();
    const { user } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async () => {
        try {
            const res = await apiClient.get('/orders/waiter/dashboard');
            if (res.data.success) {
                setStats(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch waiter stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.greeting, { color: colors.textPrimary }]}>Hello, {user?.name || 'Waiter'} 👋</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Here is your performance overview</Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsContainer}>
                <TouchableOpacity 
                    style={[styles.quickActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('POS')}
                >
                    <Ionicons name="restaurant" size={24} color="#000" style={styles.quickActionIcon} />
                    <Text style={styles.quickActionTextPrimary}>New Order</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.quickActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]}
                    onPress={() => navigation.navigate('Menu')}
                >
                    <Ionicons name="book" size={24} color={colors.textPrimary} style={styles.quickActionIcon} />
                    <Text style={[styles.quickActionTextSecondary, { color: colors.textPrimary }]}>View Menu</Text>
                </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <TouchableOpacity 
                    onPress={() => navigation.navigate('WaitersCompletedOrders')}
                    style={{ width: (width - 48) / 2 }}
                >
                    <LinearGradient
                        colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.05)']}
                        style={[styles.statCard, { borderColor: 'rgba(59, 130, 246, 0.3)', width: '100%' }]}
                    >
                        <Ionicons name="receipt" size={28} color="#60a5fa" />
                        <Text style={[styles.statValue, { color: '#fff' }]}>{stats?.totalCompleted || 0}</Text>
                        <Text style={styles.statLabel}>Today's Orders</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.2)', 'rgba(217, 119, 6, 0.05)']}
                    style={[styles.statCard, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}
                >
                    <Ionicons name="star" size={28} color="#fbbf24" />
                    <Text style={[styles.statValue, { color: '#fff' }]}>{stats?.averageRating?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.statLabel}>Avg Rating</Text>
                </LinearGradient>
            </View>

            {/* Current Active Orders */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Current Active Orders</Text>
            {stats?.activeOrders && stats.activeOrders.length > 0 ? (
                <View style={styles.activeOrdersList}>
                    {stats.activeOrders.map((order, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={[styles.activeOrderCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}
                            onPress={() => navigation.navigate('POS', { tableNumber: order.tableNumber })}
                        >
                            <View style={styles.activeOrderLeft}>
                                <Text style={[styles.activeOrderTable, { color: colors.primary }]}>{order.tableNumber}</Text>
                                <Text style={[styles.activeOrderTime, { color: colors.textMuted }]}>
                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <View style={styles.activeOrderRight}>
                                <Text style={[styles.activeOrderItems, { color: colors.textPrimary }]}>{order.items?.length || 0} items</Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No active orders right now.</Text>
            )}

            {/* Guidelines Card */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Guidelines</Text>
            <View style={[styles.guidelinesCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
                <View style={styles.guidelineItem}>
                    <View style={styles.guidelineIcon}><Ionicons name="happy" size={20} color="#4ade80" /></View>
                    <View style={styles.guidelineTextContainer}>
                        <Text style={[styles.guidelineTitle, { color: colors.textPrimary }]}>Always Smile</Text>
                        <Text style={[styles.guidelineDesc, { color: colors.textMuted }]}>Greet customers with a warm smile.</Text>
                    </View>
                </View>
                <View style={styles.guidelineItem}>
                    <View style={styles.guidelineIcon}><Ionicons name="time" size={20} color="#60a5fa" /></View>
                    <View style={styles.guidelineTextContainer}>
                        <Text style={[styles.guidelineTitle, { color: colors.textPrimary }]}>Be Punctual</Text>
                        <Text style={[styles.guidelineDesc, { color: colors.textMuted }]}>Ensure orders are taken and delivered on time.</Text>
                    </View>
                </View>
                <View style={styles.guidelineItem}>
                    <View style={styles.guidelineIcon}><Ionicons name="restaurant" size={20} color="#fbbf24" /></View>
                    <View style={styles.guidelineTextContainer}>
                        <Text style={[styles.guidelineTitle, { color: colors.textPrimary }]}>Know the Menu</Text>
                        <Text style={[styles.guidelineDesc, { color: colors.textMuted }]}>Be ready to recommend dishes and answer questions.</Text>
                    </View>
                </View>
            </View>

            {/* Recent Reviews */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Feedback</Text>
            {stats?.recentReviews && stats.recentReviews.length > 0 ? (
                stats.recentReviews.map((review, index) => (
                    <View key={index} style={[styles.reviewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }]}>
                        <View style={styles.reviewHeader}>
                            <Text style={styles.reviewStars}>
                                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </Text>
                            <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                                {new Date(review.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                        {review.feedback ? (
                            <Text style={[styles.reviewText, { color: colors.textPrimary }]}>"{review.feedback}"</Text>
                        ) : null}
                        <View style={styles.reviewOrderBadge}>
                            <Text style={styles.reviewOrderText}>{review.orderNumber}</Text>
                        </View>
                    </View>
                ))
            ) : (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No feedback yet.</Text>
            )}

            {/* Order History */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>Recent Orders</Text>
            {stats?.history && stats.history.length > 0 ? (
                <View style={styles.historyList}>
                    {stats.history.map((order, index) => (
                        <View key={index} style={[styles.historyItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }]}>
                            <View style={styles.historyLeft}>
                                <Text style={[styles.historyOrderNumber, { color: colors.textPrimary }]}>{order.orderNumber}</Text>
                                <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <View style={styles.historyRight}>
                                <Text style={[styles.historyAmount, { color: '#4ade80' }]}>₹{order.amount.toFixed(2)}</Text>
                                <Text style={[styles.historyItemsCount, { color: colors.textMuted }]}>{order.items} items</Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent orders.</Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        marginTop: 40,
        marginBottom: 24,
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
    },
    quickActionsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    quickActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
    },
    quickActionIcon: {
        marginRight: 8,
    },
    quickActionTextPrimary: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    quickActionTextSecondary: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    statCard: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    statValue: {
        fontSize: 32,
        fontWeight: '800',
        marginTop: 12,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        marginTop: 8,
    },
    activeOrdersList: {
        gap: 12,
        marginBottom: 24,
    },
    activeOrderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    activeOrderLeft: {
        gap: 4,
    },
    activeOrderTable: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    activeOrderTime: {
        fontSize: 13,
    },
    activeOrderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activeOrderItems: {
        fontSize: 15,
        fontWeight: '600',
    },
    guidelinesCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    guidelineItem: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    guidelineIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    guidelineTextContainer: {
        flex: 1,
    },
    guidelineTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    guidelineDesc: {
        fontSize: 14,
        lineHeight: 20,
    },
    reviewCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    reviewStars: {
        color: '#fbbf24',
        fontSize: 18,
        letterSpacing: 2,
    },
    reviewDate: {
        fontSize: 12,
    },
    reviewText: {
        fontSize: 15,
        fontStyle: 'italic',
        marginBottom: 12,
        lineHeight: 22,
    },
    reviewOrderBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    reviewOrderText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 24,
    },
    historyList: {
        gap: 12,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginBottom: 12,
    },
    historyLeft: {
        gap: 4,
    },
    historyOrderNumber: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyDate: {
        fontSize: 13,
    },
    historyRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    historyAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyItemsCount: {
        fontSize: 13,
    },
});
