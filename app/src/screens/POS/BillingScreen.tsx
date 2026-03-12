import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useMenuStore } from '../../store/useMenuStore';
import { useCartStore } from '../../store/useCartStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function BillingScreen({ navigation }: any) {
    const { grouped, categories, isLoading, fetchMenu } = useMenuStore();
    const { addItem, items: cartItems, getTotal, tableNumber } = useCartStore();
    const [activeCategory, setActiveCategory] = useState('');
    const [staffMode, setStaffMode] = useState(false);
    const { toggleItem } = useMenuStore();
    const cartAnim = useRef(new Animated.Value(0)).current;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    useEffect(() => { fetchMenu(); }, []);
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
                <BlurView intensity={15} tint="dark" style={styles.itemCardBlur}>
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
                            }
                        }}
                        activeOpacity={0.82}
                        disabled={!item.isAvailable && !staffMode}
                    >
                        <LinearGradient
                            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
                            style={styles.itemCardGradient}
                        >
                            <View style={styles.itemCardTop}>
                                <View style={[styles.vegDot, { backgroundColor: item.isVeg ? Colors.accentGreen : Colors.error }]}>
                                    <View style={[styles.vegDotInner, { backgroundColor: item.isVeg ? Colors.accentGreen : Colors.error }]} />
                                </View>
                                {!item.isAvailable && (
                                    <View style={styles.outOfStockBadgeSmall}>
                                        <Text style={styles.outOfStockBadgeTextSm}>OOS</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.itemName, !item.isAvailable && { opacity: 0.5 }]} numberOfLines={2}>{item.name}</Text>
                            <View style={styles.itemBottom}>
                                <View style={{ flex: 1 }} />


                                {cartItem?.status === 'ready' || cartItem?.status === 'served' ? (
                                    <View style={styles.readyBadge}>
                                        <Ionicons name="checkmark-done" size={12} color={Colors.success} />
                                        <Text style={styles.readyBadgeText}>
                                            {cartItem.status === 'served' ? 'Served' : 'Ready'}
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
                                            <Ionicons name="remove" size={16} color={Colors.white} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{qty}</Text>
                                        <TouchableOpacity
                                            style={styles.qtyBtn}
                                            onPress={() => useCartStore.getState().updateQuantity(item._id, qty + 1)}
                                        >
                                            <Ionicons name="add" size={16} color={Colors.white} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.addButton, !item.isAvailable && { backgroundColor: Colors.border }]}
                                        disabled={!item.isAvailable && !staffMode}
                                    >
                                        <Ionicons name={staffMode ? (item.isAvailable ? "eye-outline" : "eye-off-outline") : "add"} size={18} color={item.isAvailable ? Colors.white : Colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </BlurView>
            </View>
        );
    };

    if (isLoading && categories.length === 0) {
        return (
            <LinearGradient colors={Gradients.background} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading menu...</Text>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>{tableNumber}</Text>
                        <Text style={styles.headerTime}>🕐 {timeStr}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={[styles.headerBtn, staffMode && styles.headerBtnActive]} onPress={() => setStaffMode(!staffMode)}>
                            <Ionicons name={staffMode ? "lock-open-outline" : "lock-closed-outline"} size={20} color={staffMode ? Colors.primary : Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerBtn}>
                            <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
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
                                        colors={['#FF8A5C', '#FF6B35']}
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
                                <Ionicons name="restaurant-outline" size={40} color={Colors.textMuted} />
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
                            <LinearGradient colors={['#FF8A5C', '#FF6B35', '#E55A24']} style={styles.cartBarGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
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
                                    <Ionicons name="chevron-forward" size={18} color={Colors.white} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { ...Typography.body2, color: Colors.textSecondary },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    headerTime: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 10 },
    headerBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    headerBtnActive: { backgroundColor: 'rgba(255,107,53,0.12)', borderColor: 'rgba(255,107,53,0.3)' },
    categoriesWrapper: { paddingVertical: Spacing.sm },
    categoriesContent: { paddingHorizontal: Spacing.md, gap: 10 },
    categoryTab: {
        paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radius.round,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    },
    activeCategoryTab: { borderColor: 'rgba(255,107,53,0.4)', ...Shadows.primary },
    categoryText: { ...Typography.buttonSm, color: Colors.textMuted },
    activeCategoryText: { color: Colors.white },
    itemList: { padding: Spacing.sm },
    itemCardContainer: {
        flex: 1, margin: Spacing.sm, borderRadius: Radius.lg,
        overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder, ...Shadows.sm,
    },
    itemCardBlur: { flex: 1 },
    itemCardInner: { flex: 1 },
    itemCardGradient: { padding: Spacing.md, minHeight: 160, justifyContent: 'space-between' },
    itemCardTop: { flexDirection: 'row', justifyContent: 'flex-start' },
    vegDot: {
        width: 14, height: 14, borderRadius: 3, borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center',
    },
    vegDotInner: { width: 6, height: 6, borderRadius: 3 },
    itemName: { ...Typography.h5, color: Colors.textPrimary, flex: 1, marginVertical: Spacing.sm },
    itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addButton: {
        backgroundColor: Colors.primary, width: 32, height: 32,
        borderRadius: 10, justifyContent: 'center', alignItems: 'center',
        ...Shadows.primary,
    },
    qtyControls: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.sm,
        paddingHorizontal: 4, paddingVertical: 4, gap: 10,
        borderWidth: 1, borderColor: Colors.border,
    },
    readyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,214,143,0.1)',
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(0,214,143,0.3)',
    },
    readyBadgeText: { ...Typography.caption, color: Colors.success, fontWeight: '700' },
    qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    qtyText: { ...Typography.buttonSm, color: Colors.white, minWidth: 18, textAlign: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
    emptyIconBg: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    emptyTitle: { ...Typography.h4, color: Colors.textSecondary },
    emptyText: { ...Typography.body2, color: Colors.textMuted, textAlign: 'center' },
    cartBarWrapper: { position: 'absolute', bottom: 100, left: Spacing.lg, right: Spacing.lg },
    cartBar: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.glow },
    cartBarGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
    cartLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    cartBadge: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center', alignItems: 'center',
    },
    cartBadgeText: { fontSize: 14, fontWeight: '800', color: Colors.white },
    cartLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.75)' },
    cartTotal: { ...Typography.h4, color: Colors.white },
    cartRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    viewCartText: { ...Typography.buttonSm, color: Colors.white },
    outOfStockBadgeSmall: {
        backgroundColor: Colors.error,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        position: 'absolute',
        right: 0,
        top: 0
    },
    outOfStockBadgeTextSm: {
        color: Colors.white,
        fontSize: 8,
        fontWeight: '900',
    }
});
