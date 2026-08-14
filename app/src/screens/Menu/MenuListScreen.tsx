import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useMenuStore } from '../../store/useMenuStore';
import { useAuthStore } from '../../store/useAuthStore';
import apiClient from '../../api/client';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const CATEGORY_COLORS: Record<string, readonly [string, string]> = {
    Beverages: ['#4C8EFF', '#2563EB'],
    Starters: ['#d8f76a', '#C6F53D'],
    Mains: ['#9B59B6', '#6C3483'],
    Desserts: ['#FFD700', '#F59E0B'],
    Breads: ['#CD7F32', '#A16207'],
};

function getCategoryColor(cat: string): readonly [string, string] {
    return CATEGORY_COLORS[cat] || ['#4A5580', '#2D3748'];
}

export default function MenuListScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const { items, isLoading, fetchMenu, toggleItem, deleteItem } = useMenuStore();
    const { user } = useAuthStore();
    const isPoultry = user?.preferredPosMode === 'poultry';
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager';
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryRates, setCategoryRates] = useState<Record<string, string>>({});
    const [updatingRates, setUpdatingRates] = useState(false);
    const [ratesExpanded, setRatesExpanded] = useState(false);

    useEffect(() => { fetchMenu(); }, []);

    useEffect(() => {
        if (isPoultry && items.length > 0) {
            const rates: any = {};
            items.forEach((i: any) => {
                const catStr = (i.category || '').trim().toUpperCase();
                if (catStr && !rates[catStr] && i.buyingPrice > 0) rates[catStr] = String(i.buyingPrice);
            });
            setCategoryRates(prev => ({ ...rates, ...prev }));
        }
    }, [items, isPoultry]);

    const handleUpdateCategoryRates = async () => {
        setUpdatingRates(true);
        let successCount = 0;
        try {
            const updates = [];
            for (const item of (items as any[])) {
                const catStr = (item.category || '').trim().toUpperCase();
                const newBase = parseFloat(categoryRates[catStr] || '0');
                if (newBase > 0) {
                    const wastage = parseFloat(item.wastage) || 0;
                    const profit = parseFloat(item.profit) || 0;
                    const oldBase = parseFloat(item.buyingPrice) || 0;

                    if (oldBase !== newBase) {
                        const newSelling = newBase + (newBase * wastage / 100) + profit;
                        const meta = { buy: newBase, sell: +newSelling.toFixed(2), qty: item.quantityType || 'kg', wastage, profit };
                        const descBase = (item.description || '').split('||META:')[0];
                        const newDesc = descBase + '||META:' + JSON.stringify(meta);

                        updates.push(apiClient.put(`/menu/${item._id || item.id}`, {
                            ...item,
                            buyingPrice: newBase,
                            sellingPrice: +newSelling.toFixed(2),
                            price: +newSelling.toFixed(2),
                            description: newDesc
                        }));
                        successCount++;
                    }
                }
            }
            if (updates.length > 0) {
                await Promise.all(updates);
                Toast.show({ type: 'success', text1: 'Rates Updated', text2: `Updated ${successCount} items` });
                fetchMenu();
            } else {
                Toast.show({ type: 'info', text1: 'No changes', text2: 'No base rates were altered' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Update Failed' });
        }
        setUpdatingRates(false);
    };

    const uniqueCategories = Array.from(new Set(items.map(i => (i.category || '').trim().toUpperCase()))).filter(Boolean);

    const filteredItems = (items || []).filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: any) => {
        const catColors = getCategoryColor(item.category);
        const isAvailable = item.isAvailable;

        const handleToggle = async () => {
            try {
                await toggleItem(item._id);
                Toast.show({
                    type: 'success',
                    text1: 'Update Successful',
                    text2: `${item.name} is now ${!isAvailable ? 'Available' : 'Out of Stock'}`
                });
            } catch (e) {
                Toast.show({
                    type: 'error',
                    text1: 'Update Failed',
                    text2: 'Please check your connection'
                });
            }
        };

        return (
            <View style={themedStyles.card}>
                <View style={themedStyles.cardMain}>
                    {/* Category color square */}
                    <LinearGradient colors={catColors} style={themedStyles.thumb}>
                        <Ionicons name="restaurant" size={20} color="rgba(255,255,255,0.9)" />
                    </LinearGradient>

                    <View style={themedStyles.cardInfo}>
                        <View style={themedStyles.nameRow}>
                            <View style={[themedStyles.vegDot, { borderColor: item.isVeg ? (colors.success || '#00D68F') : (colors.error || '#FF5C7C') }]}>
                                <View style={[themedStyles.vegDotInner, { backgroundColor: item.isVeg ? (colors.success || '#00D68F') : (colors.error || '#FF5C7C') }]} />
                            </View>
                            <Text style={themedStyles.itemName} numberOfLines={1}>{item.name}</Text>
                        </View>

                        <View style={themedStyles.metaRow}>
                            <View style={[themedStyles.categoryChip, { borderColor: catColors[0] + '60' }]}>
                                <Text style={[themedStyles.categoryText, { color: catColors[0] }]}>{item.category}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={themedStyles.price}>₹{item.price}</Text>
                </View>

                <View style={themedStyles.cardActions}>
                    <TouchableOpacity
                        style={[themedStyles.availBtn, {
                            backgroundColor: isAvailable ? (colors.success || '#00D68F') + '1A' : (colors.error || '#FF5C7C') + '1A',
                            borderColor: isAvailable ? (colors.success || '#00D68F') + '4D' : (colors.error || '#FF5C7C') + '4D'
                        }]}
                        onPress={handleToggle}
                    >
                        <Ionicons name={isAvailable ? 'eye-outline' : 'eye-off-outline'} size={14} color={isAvailable ? (colors.success || '#00D68F') : (colors.error || '#FF5C7C')} />
                        <Text style={[themedStyles.availText, { color: isAvailable ? (colors.success || '#00D68F') : (colors.error || '#FF5C7C') }]}>
                            {isAvailable ? 'Available' : 'Sold Out'}
                        </Text>
                    </TouchableOpacity>

                    <View style={themedStyles.iconActions}>
                        <TouchableOpacity style={themedStyles.iconBtn} onPress={() => navigation.navigate('EditMenuItem', { item })}>
                            <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[themedStyles.iconBtn, { backgroundColor: (colors.error || '#FF5C7C') + '14', borderColor: (colors.error || '#FF5C7C') + '33' }]} onPress={() => deleteItem(item._id)}>
                            <Ionicons name="trash-outline" size={18} color={colors.error || '#FF5C7C'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={themedStyles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={themedStyles.headerTitle}>Menu</Text>
                        <Text style={themedStyles.headerSub}>
                            {searchQuery ? `${filteredItems.length} found` : `${items.length} items`}
                        </Text>
                    </View>
                    <TouchableOpacity style={themedStyles.addBtn} onPress={() => navigation.navigate('EditMenuItem')} activeOpacity={0.85}>
                        <LinearGradient colors={gradients.primary} style={themedStyles.addBtnGrad}>
                            <Ionicons name="add" size={22} color={colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={themedStyles.searchContainer}>
                    <Ionicons name="search" size={18} color={colors.textMuted} style={themedStyles.searchIcon} />
                    <TextInput
                        style={themedStyles.searchInput}
                        placeholder="Search dishes..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {isPoultry && isManagerOrOwner && uniqueCategories.length > 0 && (
                    <View style={themedStyles.ratesBanner}>
                        <View style={themedStyles.ratesHeader}>
                            <Ionicons name="trending-up-outline" size={24} color={colors.accent || '#00D68F'} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={themedStyles.ratesTitle}>Today's Market Rates</Text>
                                <Text style={themedStyles.ratesSub}>Sets base values & recalculates retail prices</Text>
                            </View>
                            <TouchableOpacity onPress={() => setRatesExpanded(!ratesExpanded)} style={{ padding: 4 }}>
                                <Ionicons name={ratesExpanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {ratesExpanded && (
                            <>
                                <View style={themedStyles.ratesGrid}>
                                    {uniqueCategories.map(cat => (
                                        <View key={cat} style={themedStyles.rateInputCard}>
                                            <Text style={themedStyles.rateLabel}>{cat}</Text>
                                            <View style={themedStyles.rateInputWrapper}>
                                                <Text style={themedStyles.rateSymbol}>₹</Text>
                                                <TextInput
                                                    style={themedStyles.rateInput}
                                                    value={categoryRates[cat] || ''}
                                                    onChangeText={v => setCategoryRates(prev => ({ ...prev, [cat]: v }))}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                    placeholderTextColor={colors.textMuted}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                                <TouchableOpacity style={themedStyles.ratesSaveBtn} onPress={handleUpdateCategoryRates} disabled={updatingRates}>
                                    <Text style={themedStyles.ratesSaveBtnText}>{updatingRates ? 'Updating...' : 'Save Market Rates'}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {isLoading && items.length === 0 ? (
                    <View style={themedStyles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredItems}
                        keyExtractor={(item, index) => String(item._id || item.id || index)}
                        renderItem={renderItem}
                        contentContainerStyle={themedStyles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={themedStyles.empty}>
                                <View style={themedStyles.emptyIcon}>
                                    <Ionicons name="journal-outline" size={42} color={colors.textMuted} />
                                </View>
                                <Text style={themedStyles.emptyTitle}>
                                    {searchQuery ? 'No matches found' : 'No menu items yet'}
                                </Text>
                                <Text style={themedStyles.emptyText}>
                                    {searchQuery ? `Try searching for something else` : 'Add your first item to get started'}
                                </Text>
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
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    headerSub: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.md,
        paddingHorizontal: 12, marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: colors.border, height: 46,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: colors.textPrimary, ...Typography.body2 },
    addBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.primary },
    addBtnGrad: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },
    card: {
        borderRadius: Radius.lg, marginBottom: Spacing.md, overflow: 'hidden',
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, ...Shadows.sm,
    },
    cardMain: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
    thumb: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
    vegDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    vegDotInner: { width: 6, height: 6, borderRadius: 2 },
    itemName: { ...Typography.h5, color: colors.textPrimary, flex: 1 },
    metaRow: { flexDirection: 'row' },
    categoryChip: {
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round,
        borderWidth: 1, backgroundColor: colors.glass,
    },
    categoryText: { ...Typography.overline, fontSize: 9 },
    price: { ...Typography.h4, color: colors.primary },
    cardActions: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    availBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1,
    },
    availText: { fontSize: 12, fontWeight: '700' },
    iconActions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    emptyTitle: { ...Typography.h4, color: colors.textSecondary },
    emptyText: { ...Typography.body2, color: colors.textMuted },
    ratesBanner: {
        backgroundColor: colors.card, marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: colors.border
    },
    ratesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    ratesTitle: { ...Typography.h5, color: colors.textPrimary },
    ratesSub: { ...Typography.caption, color: colors.textMuted },
    ratesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md },
    rateInputCard: { flex: 1, minWidth: 80, backgroundColor: colors.background, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    rateLabel: { ...Typography.overline, color: colors.textSecondary, marginBottom: 4 },
    rateInputWrapper: { flexDirection: 'row', alignItems: 'center' },
    rateSymbol: { color: colors.primary, marginRight: 4, fontWeight: '700' },
    rateInput: { flex: 1, color: colors.textPrimary, padding: 0, fontSize: 16 },
    ratesSaveBtn: { backgroundColor: colors.accent || '#00D68F', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    ratesSaveBtnText: { color: '#0f172a', fontWeight: '700' },
});
