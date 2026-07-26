import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme';
import apiClient from '../../api/client';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface StaffPerformance {
    id: number;
    name: string;
    role: string;
    isActive: boolean;
    totalCompleted: number;
    averageRating: number;
    recentFeedback: Array<{
        orderId: number;
        orderNumber: string;
        rating: number;
        feedback: string;
        createdAt: string;
    }>;
}

export default function StaffPerformanceScreen({ navigation }: any) {
    const { colors, isDark } = useAppTheme();
    const [staffList, setStaffList] = useState<StaffPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchPerformance = async () => {
        try {
            const res = await apiClient.get('/orders/employee/performance');
            if (res.data.success) {
                // Filter out non-POS staff (like customers or raw admins) if needed, 
                // but usually the backend returns actual staff.
                setStaffList(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch staff performance:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPerformance();
    };

    const toggleExpand = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const getRoleColor = (role: string) => {
        switch (role?.toUpperCase()) {
            case 'WAITER': return '#3b82f6';
            case 'KITCHEN':
            case 'KOT': return '#ef4444';
            case 'MANAGER': return '#8b5cf6';
            case 'BILLER': return '#10b981';
            default: return '#64748b';
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: isDark ? '#333' : '#e2e8f0' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Staff Performance</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView 
                style={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {staffList.length > 0 ? (
                    staffList.map((staff) => (
                        <View key={staff.id} style={[styles.cardContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }]}>
                            <TouchableOpacity 
                                style={styles.cardHeader}
                                onPress={() => toggleExpand(staff.id)}
                            >
                                <View style={styles.cardLeft}>
                                    <View style={[styles.avatar, { backgroundColor: getRoleColor(staff.role) + '20' }]}>
                                        <Text style={[styles.avatarText, { color: getRoleColor(staff.role) }]}>
                                            {staff.name?.charAt(0)?.toUpperCase() || '?'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.staffName, { color: colors.textPrimary }]}>{staff.name}</Text>
                                        <View style={styles.roleBadgeContainer}>
                                            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(staff.role) }]}>
                                                <Text style={styles.roleBadgeText}>{staff.role || 'STAFF'}</Text>
                                            </View>
                                            {!staff.isActive && (
                                                <Text style={styles.inactiveText}>Inactive</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                
                                <View style={styles.cardRight}>
                                    <View style={styles.quickStat}>
                                        <Text style={[styles.quickStatValue, { color: colors.textPrimary }]}>{staff.totalCompleted}</Text>
                                        <Text style={styles.quickStatLabel}>Orders</Text>
                                    </View>
                                    <View style={styles.quickStat}>
                                        <Text style={[styles.quickStatValue, { color: '#fbbf24' }]}>{staff.averageRating?.toFixed(1) || '0.0'}</Text>
                                        <Text style={styles.quickStatLabel}>Rating</Text>
                                    </View>
                                    <Ionicons 
                                        name={expandedId === staff.id ? "chevron-up" : "chevron-down"} 
                                        size={20} 
                                        color={colors.textMuted} 
                                        style={{ marginLeft: 8 }}
                                    />
                                </View>
                            </TouchableOpacity>

                            {expandedId === staff.id && (
                                <View style={[styles.expandedContent, { borderTopColor: isDark ? '#333' : '#f1f5f9' }]}>
                                    <Text style={[styles.sectionSubtitle, { color: colors.textPrimary }]}>Recent Reviews</Text>
                                    
                                    {staff.recentFeedback && staff.recentFeedback.length > 0 ? (
                                        staff.recentFeedback.map((review, idx) => (
                                            <View key={idx} style={[styles.reviewItem, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc' }]}>
                                                <View style={styles.reviewTop}>
                                                    <Text style={[styles.reviewOrderNumber, { color: colors.primary }]}>{review.orderNumber}</Text>
                                                    <Text style={styles.reviewStars}>
                                                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.reviewFeedback, { color: colors.textPrimary }]}>"{review.feedback}"</Text>
                                                <Text style={styles.reviewDate}>
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={[styles.noReviewsText, { color: colors.textMuted }]}>No written feedback yet.</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No staff performance data available.</Text>
                    </View>
                )}
                <View style={{ height: 40 }} />
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
    cardContainer: {
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.1)',
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    staffName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    roleBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    roleBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    inactiveText: {
        fontSize: 12,
        color: '#ef4444',
        fontStyle: 'italic',
    },
    cardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    quickStat: {
        alignItems: 'center',
    },
    quickStatValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    quickStatLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    expandedContent: {
        padding: 16,
        borderTopWidth: 1,
    },
    sectionSubtitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    reviewItem: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    reviewTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    reviewOrderNumber: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    reviewStars: {
        color: '#fbbf24',
        fontSize: 12,
        letterSpacing: 1,
    },
    reviewFeedback: {
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    reviewDate: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'right',
    },
    noReviewsText: {
        fontSize: 14,
        fontStyle: 'italic',
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
