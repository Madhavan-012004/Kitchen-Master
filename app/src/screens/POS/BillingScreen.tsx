import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Animated, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useMenuStore } from '../../store/useMenuStore';
import { useCartStore } from '../../store/useCartStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import api from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../hooks/useSocket';
import { NotificationBell } from '../../components/NotificationBell';

export default function BillingScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const styles = React.useMemo(() => createStyles(colors, gradients), [colors, gradients]);
    
    const { grouped, categories, isLoading, fetchMenu } = useMenuStore();
    const { addItem, items: cartItems, getTotal, tableNumber, loadOrder, clearCart, setTableNumber: setTableNum } = useCartStore();
    const { user } = useAuthStore();
    const { i18n } = useTranslation();
    const [activeCategory, setActiveCategory] = useState('');
    const [staffMode, setStaffMode] = useState(false);
    const [activeOrders, setActiveOrders] = useState<any[]>([]);
    const [localSets, setLocalSets] = useState<Record<string, string[]>>({});
    const [showCombineModal, setShowCombineModal] = useState(false);
    const [combineTargetTable, setCombineTargetTable] = useState('');
    const [isCombining, setIsCombining] = useState(false);
    const { toggleItem } = useMenuStore();
    const cartAnim = useRef(new Animated.Value(0)).current;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    const fetchActiveOrders = async () => {
        try {
            const response = await api.get('/orders?paymentStatus=unpaid&limit=100');
            setActiveOrders(response.data.data.orders || []);
        } catch (error) { }
    };

    const socket = useSocket();

    useEffect(() => {
        if (!socket) return;
        
        socket.on('notification:send', (data: any) => {
            if (data.message) {
                Toast.show({
                    type: 'info',
                    text1: 'Kitchen Notification',
                    text2: data.message,
                    visibilityTime: 10000,
                    autoHide: true,
                    topOffset: 60
                });
            }
        });

        return () => {
            socket.off('notification:send');
        };
    }, [socket]);

    useEffect(() => { 
        fetchMenu(); 
        fetchActiveOrders();
    }, []);

    const handleCombine = async () => {
        if (!combineTargetTable) return;
        setIsCombining(true);
        try {
            const targetOrder = activeOrders.find(o => o.tableNumber === combineTargetTable);
            await api.post('/orders/combine-tables', {
                sourceTable: tableNumber,
                targetOrderId: targetOrder ? targetOrder._id : null,
                targetTable: combineTargetTable
            });
            Toast.show({ type: 'success', text1: 'Tables Combined' });
            setShowCombineModal(false);
            setCombineTargetTable('');
            fetchActiveOrders();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Combine Failed', text2: error.response?.data?.message });
        } finally {
            setIsCombining(false);
        }
    };

    const handleUnmerge = async (tableToUnmerge: string) => {
        const existing = activeOrders.find(o => o.tableNumber === tableNumber);
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
    useEffect(() => {
        if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0]);
    }, [categories]);

    useEffect(() => {
        Animated.spring(cartAnim, {
            toValue: cartItems.length > 0 ? 1 : 0,
            tension: 60, friction: 10, useNativeDriver: true,
        }).start();
    }, [cartItems.length]);

    const MenuItem = ({ item }: any) => {
        const isVeg = item.isVeg;
        const cartItem = cartItems.find(i => i.menuItemId === item._id);
        const qty = cartItem ? cartItem.quantity : 0;

        return (
            <View style={styles.itemCardContainer}>
                <BlurView intensity={15} tint={isDark ? "dark" : "light"} style={styles.itemCardBlur}>
                    <TouchableOpacity
                        style={styles.itemCardInner}
                        onPress={async () => {
                            if (!item.isAvailable && !staffMode) return;
                            if (staffMode) {
                                try {
                                    await toggleItem(item._id);
                                    Toast.show({
                                        type: 'success',
                                        text1: 'Update Successful',
                                        text2: `${item.name} is now ${item.isAvailable ? 'Out of Stock' : 'Available'}`
                                    });
                                } catch (e) {
                                    Toast.show({ type: 'error', text1: 'Update Failed' });
                                }
                            } else if (qty === 0) {
                                addItem({ menuItemId: item._id, name: item.name, price: item.price, quantity: 1, taxRate: item.taxRate, category: item.category });
                            } else {
                                useCartStore.getState().updateQuantity(item._id, qty + 1);
                            }
                        }}
                        activeOpacity={0.82}
                        disabled={!item.isAvailable && !staffMode}
                    >
                        <LinearGradient
                            colors={isDark ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)'] : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.005)']}
                            style={styles.itemCardGradient}
                        >
                            <View style={styles.itemCardTop}>
                                <View style={[styles.vegDot, { backgroundColor: item.isVeg ? colors.accentGreen : colors.error }]}>
                                    <View style={[styles.vegDotInner, { backgroundColor: item.isVeg ? colors.accentGreen : colors.error }]} />
                                </View>
                                {!item.isAvailable && (
                                    <View style={styles.outOfStockBadgeSmall}>
                                        <Text style={styles.outOfStockBadgeTextSm}>OOS</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.itemName, !item.isAvailable && { opacity: 0.5 }]} numberOfLines={2}>
                                {(i18n.language === 'ta' && item.tamilName) ? item.tamilName : item.name}
                            </Text>
                            <View style={styles.itemBottom}>
                                <View style={{ flex: 1 }} />


                                {cartItem?.status?.toUpperCase() === 'READY' || cartItem?.status?.toUpperCase() === 'SERVED' ? (
                                    <View style={styles.readyBadge}>
                                        <Ionicons name="checkmark-done" size={12} color={colors.success} />
                                        <Text style={styles.readyBadgeText}>
                                            {cartItem.status?.toUpperCase() === 'SERVED' ? 'Served' : 'Ready'}
                                        </Text>
                                    </View>
                                ) : qty > 0 ? (
                                    <View style={styles.qtyControls}>
                                        <TouchableOpacity
                                            style={styles.qtyBtn}
                                            onPress={() => {
                                                if (qty === 1) useCartStore.getState().removeItem(item._id);
                                                else useCartStore.getState().updateQuantity(item._id, qty - 1);
                                            }}
                                        >
                                            <Ionicons name="remove" size={16} color={'#000000'} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{qty}</Text>
                                        <TouchableOpacity
                                            style={styles.qtyBtn}
                                            onPress={() => useCartStore.getState().updateQuantity(item._id, qty + 1)}
                                        >
                                            <Ionicons name="add" size={16} color={'#000000'} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.addButton, !item.isAvailable && { backgroundColor: colors.border }]}
                                        disabled={!item.isAvailable && !staffMode}
                                        onPress={async () => {
                                            if (!item.isAvailable && !staffMode) return;
                                            if (staffMode) {
                                                try {
                                                    await toggleItem(item._id);
                                                    Toast.show({
                                                        type: 'success',
                                                        text1: 'Update Successful',
                                                        text2: `${item.name} is now ${item.isAvailable ? 'Out of Stock' : 'Available'}`
                                                    });
                                                } catch (e) {
                                                    Toast.show({ type: 'error', text1: 'Update Failed' });
                                                }
                                            } else if (qty === 0) {
                                                addItem({ menuItemId: item._id, name: item.name, price: item.price, quantity: 1, taxRate: item.taxRate, category: item.category });
                                            }
                                        }}
                                    >
                                        <Ionicons name={staffMode ? (item.isAvailable ? "eye-outline" : "eye-off-outline") : "add"} size={18} color={item.isAvailable ? '#000000' : colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </BlurView>
            </View>
        );
    };

    const removeSet = (setKey: string) => {
        if (!setKey.includes(' - Set ')) return;
        const baseTable = setKey.split(' - Set')[0];
        
        setLocalSets(prev => ({
            ...prev,
            [baseTable]: (prev[baseTable] || []).filter(s => s !== setKey)
        }));

        if (tableNumber === setKey) {
            setTableNum(baseTable);
            clearCart();
        }
        Toast.show({ type: 'info', text1: 'Group Removed', text2: `${setKey} has been removed` });
    };

    if (isLoading && categories.length === 0) {
        return (
            <LinearGradient colors={gradients.background} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading menu...</Text>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={gradients.background} style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerMainRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{tableNumber}</Text>
                            <Text style={styles.headerTime}>🕐 {timeStr}</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <NotificationBell />
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCombineModal(true)}>
                                <Ionicons name="git-merge-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.headerBtn, staffMode && styles.headerBtnActive]} onPress={() => setStaffMode(!staffMode)}>
                                <Ionicons name={staffMode ? "lock-open-outline" : "lock-closed-outline"} size={20} color={staffMode ? colors.primary : colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerBtn}>
                                <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Group/Set Switcher (Relocated to Header) */}
                    {tableNumber.startsWith('Table ') && (
                        <View style={styles.headerSwitcherBar}>
                            <View style={styles.headerSwitcherTitleRow}>
                                <Ionicons name="people" size={12} color={colors.primary} />
                                <Text style={styles.headerSwitcherLabel}>GROUPS</Text>
                                {(() => {
                                    const baseTable = tableNumber.split(' - Set')[0];
                                    const backendSets = activeOrders.filter(o => o.tableNumber === baseTable || o.tableNumber.startsWith(`${baseTable} - Set`)).map(o => o.tableNumber);
                                    const trackedLocalSets = localSets[baseTable] || [baseTable];
                                    const allSets = Array.from(new Set([...backendSets, ...trackedLocalSets]));
                                    if (allSets.length > 1 && tableNumber === baseTable) {
                                        return <Text style={styles.headerSwitcherRequired}>(Pick One)</Text>;
                                    }
                                    return null;
                                })()}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerSwitcherScroll}>
                                {(() => {
                                    const baseTable = tableNumber.split(' - Set')[0];
                                    const backendSets = activeOrders.filter(o => o.tableNumber === baseTable || o.tableNumber.startsWith(`${baseTable} - Set`)).map(o => o.tableNumber);
                                    const trackedLocalSets = localSets[baseTable] || [baseTable];
                                    const allSets = Array.from(new Set([...backendSets, ...trackedLocalSets])).sort();
                                    
                                    return (
                                        <>
                                            {allSets.map((setKey, idx) => (
                                                <View key={setKey} style={styles.setBtnWrapper}>
                                                    <TouchableOpacity 
                                                        style={[
                                                            styles.setBtn, 
                                                            tableNumber === setKey && styles.setBtnActive,
                                                            (allSets.length > 1 && tableNumber === baseTable) && { borderColor: 'rgba(198, 245, 61, 0.3)' }
                                                        ]}
                                                        onPress={() => {
                                                            const existing = activeOrders.find(o => o.tableNumber === setKey);
                                                            if (existing) loadOrder(existing);
                                                            else {
                                                                clearCart();
                                                                setTableNum(setKey);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={[styles.setBtnText, tableNumber === setKey && styles.setBtnTextActive]}>set{idx + 1}</Text>
                                                    </TouchableOpacity>
                                                    {setKey.includes(' - Set ') && (
                                                        <TouchableOpacity 
                                                            style={styles.removeSetBtn}
                                                            onPress={() => removeSet(setKey)}
                                                        >
                                                            <Ionicons name="close-circle" size={14} color={colors.error} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            ))}
                                            <TouchableOpacity 
                                                style={styles.addSetHeaderBtn}
                                                onPress={() => {
                                                    const nextIdx = allSets.length + 1;
                                                    const newSetKey = `${baseTable} - Set ${nextIdx}`;
                                                    setLocalSets(prev => ({
                                                        ...prev,
                                                        [baseTable]: [...(prev[baseTable] || [baseTable]), newSetKey]
                                                    }));
                                                    clearCart();
                                                    setTableNum(newSetKey);
                                                }}
                                            >
                                                <Ionicons name="add" size={16} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        </>
                                    );
                                })()}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Category Tabs */}
                <View style={styles.categoriesWrapper}>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={categories}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.categoryTab, activeCategory === item && styles.activeCategoryTab]}
                                onPress={() => setActiveCategory(item)}
                                activeOpacity={0.8}
                            >
                                {activeCategory === item && (
                                    <LinearGradient
                                        colors={gradients.primary}
                                        style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]}
                                    />
                                )}
                                <Text style={[styles.categoryText, activeCategory === item && styles.activeCategoryText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.categoriesContent}
                    />
                </View>

                {/* Menu Items Grid */}
                <FlatList
                    data={grouped[activeCategory] || []}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <MenuItem item={item} />}
                    numColumns={2}
                    contentContainerStyle={[styles.itemList, { paddingBottom: cartItems.length > 0 ? 190 : 120 }]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBg}>
                                <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} />
                            </View>
                            <Text style={styles.emptyTitle}>No items here</Text>
                            <Text style={styles.emptyText}>This category has no menu items yet.</Text>
                        </View>
                    }
                />

                {/* Cart Bar */}
                {cartItems.length > 0 && (
                    <Animated.View style={[styles.cartBarWrapper, { opacity: cartAnim, transform: [{ translateY: cartAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }] }]}>
                        <TouchableOpacity style={styles.cartBar} activeOpacity={0.92} onPress={() => navigation.navigate('Checkout')}>
                            <LinearGradient colors={gradients.primary} style={styles.cartBarGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <View style={styles.cartLeft}>
                                    <View style={styles.cartBadge}>
                                        <Text style={styles.cartBadgeText}>{cartItems.reduce((s, i) => s + i.quantity, 0)}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.cartLabel}>Items in order</Text>
                                        <Text style={styles.cartTotal}>₹{getTotal()}</Text>
                                    </View>
                                </View>
                                <View style={styles.cartRight}>
                                    <Text style={styles.viewCartText}>View Order</Text>
                                    <Ionicons name="chevron-forward" size={18} color={'#000000'} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </SafeAreaView>
            {/* Combine Modal */}
            <Modal visible={showCombineModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Combine Order</Text>
                            <TouchableOpacity onPress={() => setShowCombineModal(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select target table for {tableNumber}</Text>

                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {(() => {
                                const currentOrder = activeOrders.find(o => o.tableNumber === tableNumber);
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
                                    if (key === tableNumber) return null;
                                    
                                    // Don't show already merged tables as selection targets
                                    const currentOrder = activeOrders.find(o => o.tableNumber === tableNumber);
                                    if (currentOrder?.mergedTables?.includes(key)) return null;

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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { ...Typography.body2, color: colors.textSecondary },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        ...Typography.h2,
        color: colors.textPrimary,
    },
    headerTime: {
        ...Typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    headerSwitcherBar: {
        backgroundColor: colors.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        padding: 10,
    },
    headerSwitcherTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 5,
    },
    headerSwitcherLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    headerSwitcherRequired: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.primary,
        fontStyle: 'italic',
        marginLeft: 'auto',
    },
    headerSwitcherScroll: {
        gap: 10,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerBtnActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '1A', // 10% opacity
    },
    categoriesWrapper: { paddingVertical: Spacing.sm },
    categoryTab: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: 10,
        marginRight: Spacing.sm,
        borderRadius: Radius.round,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        position: 'relative',
        overflow: 'hidden',
    },
    activeCategoryTab: { borderColor: 'transparent' },
    categoryText: { ...Typography.buttonSm, color: colors.textSecondary },
    activeCategoryText: { color: '#000000', fontWeight: '700' },
    categoriesContent: { paddingHorizontal: Spacing.lg },
    itemList: { padding: Spacing.lg },
    itemCardContainer: {
        flex: 1, margin: Spacing.sm, borderRadius: Radius.lg,
        overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...Shadows.sm,
    },
    itemCardBlur: { flex: 1 },
    itemCardInner: { flex: 1 },
    itemCardGradient: { padding: Spacing.md, minHeight: 160, justifyContent: 'space-between' },
    itemCardTop: { flexDirection: 'row', justifyContent: 'flex-start' },
    vegDot: {
        width: 14, height: 14, borderRadius: 3, borderWidth: 1.5,
        borderColor: colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)', 
        justifyContent: 'center', alignItems: 'center',
    },
    vegDotInner: { width: 6, height: 6, borderRadius: 3 },
    itemName: { ...Typography.h5, color: colors.textPrimary, flex: 1, marginVertical: Spacing.sm },
    itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addButton: {
        backgroundColor: colors.primary, width: 32, height: 32,
        borderRadius: 10, justifyContent: 'center', alignItems: 'center',
        ...Shadows.primary,
    },
    qtyControls: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.sm,
        paddingHorizontal: 4, paddingVertical: 4, gap: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    readyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.success + '1A', // 10% opacity
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.success + '4D', // 30% opacity
    },
    readyBadgeText: { ...Typography.caption, color: colors.success, fontWeight: '700' },
    qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    qtyText: { ...Typography.buttonSm, color: colors.white, minWidth: 18, textAlign: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
    emptyIconBg: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    emptyTitle: { ...Typography.h4, color: colors.textSecondary },
    emptyText: { ...Typography.body2, color: colors.textMuted, textAlign: 'center' },
    cartBarWrapper: { position: 'absolute', bottom: 100, left: Spacing.lg, right: Spacing.lg },
    cartBar: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.glow },
    cartBarGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
    cartLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    cartBadge: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    cartBadgeText: { fontSize: 14, fontWeight: '800', color: '#000000' },
    cartLabel: { ...Typography.caption, color: 'rgba(0,0,0,0.6)' },
    cartTotal: { ...Typography.h4, color: '#000000' },
    cartRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    viewCartText: { ...Typography.buttonSm, color: '#000000' },
    outOfStockBadgeSmall: {
        backgroundColor: colors.error,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        position: 'absolute',
        right: 0,
        top: 0
    },
    outOfStockBadgeTextSm: {
        color: colors.white,
        fontSize: 8,
        fontWeight: '900',
    },
    setBtnWrapper: {
        position: 'relative',
        marginRight: 4,
    },
    setBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 50,
        alignItems: 'center',
    },
    setBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    setBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    setBtnTextActive: {
        color: '#000000',
    },
    removeSetBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 10,
        backgroundColor: colors.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addSetHeaderBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
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
    modalActionText: { ...Typography.h5, color: colors.white, fontWeight: '700' },
    currentMergesContainer: { marginBottom: Spacing.md },
    mergeSectionTitle: { ...Typography.caption, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
    mergePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    mergePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '33' },
    mergePillText: { ...Typography.buttonSm, color: colors.primary, fontWeight: '700' },
    unmergePillBtn: { padding: 2 },
    mergeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10, opacity: 0.5 },
});
