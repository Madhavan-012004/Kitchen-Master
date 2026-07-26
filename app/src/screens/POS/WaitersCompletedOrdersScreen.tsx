import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme';
import apiClient from '../../api/client';

interface CompletedOrder {
    id: number;
    orderNumber: string;
    amount: number;
    items: number;
    createdAt: string;
    rating?: number;
    feedback?: string;
}

export default function WaitersCompletedOrdersScreen({ navigation }: any) {
    const { colors, isDark } = useAppTheme();
    const [orders, setOrders] = useState<CompletedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Simple grouping by date (YYYY-MM-DD)
    const [groupedOrders, setGroupedOrders] = useState<{ [key: string]: CompletedOrder[] }>({});

    const fetchHistory = async () => {
        try {
            const res = await apiClient.get('/orders/waiter/dashboard');
            if (res.data.success) {
                const history = res.data.data.history || [];
                // Group by date
                const groups: { [key: string]: CompletedOrder[] } = {};
                history.forEach((order: CompletedOrder) => {
                    const dateStr = new Date(order.createdAt).toLocaleDateString();
                    if (!groups[dateStr]) {
                        groups[dateStr] = [];
                    }
                    groups[dateStr].push(order);
                });
                
                // Add reviews to orders if they match
                const reviews = res.data.data.recentFeedback || [];
                Object.keys(groups).forEach(date => {
                    groups[date] = groups[date].map(order => {
                        const review = reviews.find((r: any) => r.orderId === order.id);
                        if (review) {
                            return { ...order, rating: review.rating, feedback: review.feedback };
                        }
                        return order;
                    });
                });
                
                setOrders(history);
                setGroupedOrders(groups);
            }
        } catch (error) {
            console.error('Failed to fetch waiter history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: isDark ? '#333' : '#e2e8f0' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Completed Orders</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView 
                style={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {Object.keys(groupedOrders).length > 0 ? (
                    Object.keys(groupedOrders).map((date) => (
                        <View key={date} style={styles.dateGroup}>
                            <Text style={[styles.dateHeader, { color: colors.primary }]}>{date}</Text>
                            {groupedOrders[date].map((order, index) => (
                                <View key={index} style={[styles.orderCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}>
                                    <View style={styles.orderHeader}>
                                        <Text style={[styles.orderNumber, { color: colors.textPrimary }]}>{order.orderNumber}</Text>
                                        <Text style={[styles.orderTime, { color: colors.textMuted }]}>
                                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    
                                    <View style={styles.orderDetails}>
                                        <Text style={[styles.orderAmount, { color: '#4ade80' }]}>₹{order.amount.toFixed(2)}</Text>
                                        <Text style={[styles.orderItems, { color: colors.textMuted }]}>{order.items} items</Text>
                                    </View>
                                    
                                    {order.rating && (
                                        <View style={[styles.reviewContainer, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7' }]}>
                                            <View style={styles.reviewHeader}>
                                                <Text style={styles.reviewStars}>
                                                    {'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}
                                                </Text>
                                                <Text style={styles.reviewLabel}>Customer Review</Text>
                                            </View>
                                            {order.feedback ? (
                                                <Text style={[styles.reviewText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                                                    "{order.feedback}"
                                                </Text>
                                            ) : null}
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No completed orders found.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        flex: 1,
        padding: 16,
    },
    dateGroup: {
        marginBottom: 24,
    },
    dateHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 12,
        marginLeft: 4,
    },
    orderCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    orderTime: {
        fontSize: 13,
    },
    orderDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    orderItems: {
        fontSize: 14,
    },
    reviewContainer: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    reviewStars: {
        color: '#fbbf24',
        fontSize: 14,
        letterSpacing: 2,
    },
    reviewLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        color: '#fbbf24',
    },
    reviewText: {
        fontSize: 14,
        fontStyle: 'italic',
        marginTop: 4,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
    }
});
