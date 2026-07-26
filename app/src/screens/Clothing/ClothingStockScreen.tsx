import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Animated, StatusBar, RefreshControl,
    Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
    getClothingProducts,
    getVariantsForProduct,
    getLowStockVariants,
    getClothingStats,
    restockVariant,
} from '../../api/clothing';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

// ── Restock Modal ─────────────────────────────────────────────────────────────
function RestockModal({
    visible,
    variant,
    colors,
    gradients,
    isDark,
    onClose,
    onSubmit,
}: {
    visible: boolean;
    variant: any;
    colors: any;
    gradients: any;
    isDark: boolean;
    onClose: () => void;
    onSubmit: (qty: number, target: 'main' | 'sub') => void;
}) {
    const [qty, setQty] = useState('');
    const [target, setTarget] = useState<'main' | 'sub'>('main');

    const handleSubmit = () => {
        const parsed = parseInt(qty, 10);
        if (!parsed || parsed <= 0) {
            Alert.alert('Invalid Quantity', 'Enter a valid positive number.');
            return;
        }
        onSubmit(parsed, target);
        setQty('');
        setTarget('main');
    };

    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={themedStyles.modalOverlay}>
                <View style={themedStyles.modalSheet}>
                    <View style={themedStyles.modalHandle} />
                    <Text style={themedStyles.modalTitle}>Restock Variant</Text>
                    {variant && (
                        <Text style={themedStyles.modalSubtitle}>
                            {variant.size} • {variant.color}
                        </Text>
                    )}

                    <Text style={themedStyles.modalLabel}>Stock Location</Text>
                    <View style={themedStyles.targetRow}>
                        <TouchableOpacity
                            style={[themedStyles.targetBtn, target === 'main' && themedStyles.targetBtnActive]}
                            onPress={() => setTarget('main')}
                        >
                            <Text style={[themedStyles.targetBtnText, target === 'main' && { color: colors.textInverse }]}>
                                Main Stock
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[themedStyles.targetBtn, target === 'sub' && themedStyles.targetBtnActive]}
                            onPress={() => setTarget('sub')}
                        >
                            <Text style={[themedStyles.targetBtnText, target === 'sub' && { color: colors.textInverse }]}>
                                Sub Stock
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={themedStyles.modalLabel}>Quantity to Add</Text>
                    <TextInput
                        style={themedStyles.modalInput}
                        placeholder="e.g. 50"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        value={qty}
                        onChangeText={setQty}
                    />

                    <View style={themedStyles.modalActions}>
                        <TouchableOpacity style={themedStyles.cancelBtn} onPress={onClose}>
                            <Text style={themedStyles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={themedStyles.submitBtn} onPress={handleSubmit}>
                            <LinearGradient colors={gradients.primary} style={themedStyles.submitBtnGrad}>
                                <Text style={themedStyles.submitBtnText}>Restock</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ClothingStockScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    const [products, setProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [variants, setVariants] = useState<any[]>([]);
    const [lowStock, setLowStock] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'low'>('all');
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);

    const listAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        else setRefreshing(true);

        try {
            const [prodRes, lowRes, statsRes] = await Promise.all([
                getClothingProducts(),
                getLowStockVariants(),
                getClothingStats(),
            ]);
            const prods = prodRes.data.data || [];
            setProducts(prods);
            setLowStock(lowRes.data.data || []);
            setStats(statsRes.data.data || null);

            // Auto-select first product
            if (prods.length > 0) {
                const first = prods[0];
                setSelectedProduct(first);
                const varRes = await getVariantsForProduct(first.id);
                setVariants(varRes.data.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    }, [listAnim]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSelectProduct = async (product: any) => {
        setSelectedProduct(product);
        try {
            const res = await getVariantsForProduct(product.id);
            setVariants(res.data.data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRestock = async (qty: number, target: 'main' | 'sub') => {
        if (!selectedVariant) return;
        try {
            await restockVariant(selectedVariant.id, { quantity: qty, target });
            setShowRestockModal(false);
            Alert.alert('Success', `Restocked ${qty} units to ${target} stock.`);
            if (selectedProduct) {
                const res = await getVariantsForProduct(selectedProduct.id);
                setVariants(res.data.data || []);
            }
            const lowRes = await getLowStockVariants();
            setLowStock(lowRes.data.data || []);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to restock variant.');
        }
    };

    const displayVariants = filter === 'low'
        ? variants.filter(v => (v.mainStock + (v.subStock || 0)) <= (v.lowStockThreshold || 5))
        : variants;

    const getVariantStock = (v: any) => (v.mainStock || 0) + (v.subStock || 0);

    const getStockColor = (v: any) => {
        const total = getVariantStock(v);
        const threshold = v.lowStockThreshold || 5;
        if (total === 0) return colors.error;
        if (total <= threshold) return colors.warning;
        return colors.accentGreen || colors.success;
    };

    const getStockLabel = (v: any) => {
        const total = getVariantStock(v);
        const threshold = v.lowStockThreshold || 5;
        if (total === 0) return 'Out of Stock';
        if (total <= threshold) return 'Low Stock';
        return 'In Stock';
    };

    // ── Product Chip ──────────────────────────────────────────────────────────
    const renderProductChip = ({ item }: any) => {
        const isSelected = selectedProduct?.id === item.id;
        return (
            <TouchableOpacity
                style={[themedStyles.productChip, isSelected && themedStyles.productChipActive]}
                onPress={() => handleSelectProduct(item)}
            >
                <Ionicons
                    name="shirt-outline"
                    size={14}
                    color={isSelected ? colors.textInverse : colors.textMuted}
                />
                <Text style={[themedStyles.productChipText, isSelected && { color: colors.textInverse }]}>
                    {item.name}
                </Text>
            </TouchableOpacity>
        );
    };

    // ── Variant Card ──────────────────────────────────────────────────────────
    const renderVariantCard = ({ item }: any) => {
        const total = getVariantStock(item);
        const barColor = getStockColor(item);
        const threshold = item.lowStockThreshold || 5;
        const max = Math.max(threshold * 4, 20);
        const pct = Math.min(100, Math.round((total / max) * 100));

        return (
            <View style={themedStyles.card}>
                <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.04)', 'transparent'] : ['rgba(0,0,0,0.02)', 'transparent']}
                    style={themedStyles.cardGradient}
                >
                    <View style={themedStyles.cardTop}>
                        <View style={themedStyles.cardMeta}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[themedStyles.colorDot, { backgroundColor: item.colorHex || colors.primary }]} />
                                <Text style={themedStyles.variantName}>{item.size}</Text>
                                <Text style={themedStyles.variantSub}>• {item.color}</Text>
                            </View>
                            {item.sku && <Text style={themedStyles.skuText}>SKU: {item.sku}</Text>}
                        </View>
                        <View style={themedStyles.stockInfo}>
                            <Text style={[themedStyles.stockValue, { color: barColor }]}>{total}</Text>
                            <Text style={themedStyles.unit}>pcs</Text>
                        </View>
                    </View>

                    <View style={themedStyles.progressBg}>
                        <View style={[themedStyles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>

                    <View style={themedStyles.cardBottom}>
                        <View style={[themedStyles.statusBadge, { backgroundColor: barColor + '26' }]}>
                            <Text style={[themedStyles.statusText, { color: barColor }]}>
                                {getStockLabel(item)}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            {item.subStock !== undefined && (
                                <View style={themedStyles.subStockChip}>
                                    <Text style={themedStyles.subStockText}>Sub: {item.subStock}</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={themedStyles.adjustBtn}
                                onPress={() => { setSelectedVariant(item); setShowRestockModal(true); }}
                            >
                                <Ionicons name="flash" size={14} color={colors.primary} />
                                <Text style={themedStyles.adjustText}>Restock</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    if (loading) {
        return (
            <LinearGradient colors={gradients.background} style={themedStyles.container}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
                <View style={themedStyles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>

                {/* Header */}
                <View style={themedStyles.header}>
                    <View>
                        <Text style={themedStyles.title}>Clothing Stock</Text>
                        <Text style={themedStyles.subtitle}>
                            {selectedProduct ? selectedProduct.name : 'Select a product'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={themedStyles.addBtn}
                        onPress={() => navigation.navigate('AddClothingProduct')}
                    >
                        <LinearGradient colors={gradients.primary} style={themedStyles.addBtnGradient}>
                            <Ionicons name="add" size={24} color={colors.textInverse} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                {stats && (
                    <View style={themedStyles.statsRow}>
                        <View style={themedStyles.statCard}>
                            <Text style={themedStyles.statVal}>{stats.totalProducts ?? products.length}</Text>
                            <Text style={themedStyles.statLabel}>Products</Text>
                        </View>
                        <View style={themedStyles.statCard}>
                            <Text style={[themedStyles.statVal, { color: colors.accentBlue }]}>
                                {stats.totalVariants ?? variants.length}
                            </Text>
                            <Text style={themedStyles.statLabel}>Variants</Text>
                        </View>
                        <View style={themedStyles.statCard}>
                            <Text style={[themedStyles.statVal, { color: colors.warning }]}>
                                {lowStock.length}
                            </Text>
                            <Text style={themedStyles.statLabel}>Low Stock</Text>
                        </View>
                    </View>
                )}

                {/* Product Chips */}
                <FlatList
                    data={products}
                    renderItem={renderProductChip}
                    keyExtractor={i => String(i.id)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={themedStyles.chipsContainer}
                    style={themedStyles.chipsRow}
                />

                {/* Filter Row */}
                <View style={themedStyles.filterRow}>
                    <TouchableOpacity
                        style={[themedStyles.filterTab, filter === 'all' && themedStyles.filterActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[themedStyles.filterText, filter === 'all' && themedStyles.filterTextActive]}>
                            All Variants
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[themedStyles.filterTab, filter === 'low' && themedStyles.filterActiveWarn]}
                        onPress={() => setFilter('low')}
                    >
                        <Ionicons
                            name="warning"
                            size={12}
                            color={filter === 'low' ? colors.warning : colors.textMuted}
                        />
                        <Text style={[themedStyles.filterText, filter === 'low' && { color: colors.warning }]}>
                            Low Stock
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Variants List */}
                <Animated.View style={{ flex: 1, opacity: listAnim }}>
                    <FlatList
                        data={displayVariants}
                        renderItem={renderVariantCard}
                        keyExtractor={i => String(i.id)}
                        contentContainerStyle={themedStyles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => fetchData(true)}
                                tintColor={colors.primary}
                            />
                        }
                        ListEmptyComponent={
                            <View style={themedStyles.center}>
                                <Ionicons name="shirt-outline" size={48} color={colors.textMuted} />
                                <Text style={themedStyles.emptyTitle}>
                                    {filter === 'low' ? 'No low-stock variants' : 'No variants found'}
                                </Text>
                                <Text style={themedStyles.emptySubtitle}>
                                    {filter === 'low' ? 'All variants are sufficiently stocked.' : 'Select a product above.'}
                                </Text>
                            </View>
                        }
                    />
                </Animated.View>
            </SafeAreaView>

            <RestockModal
                visible={showRestockModal}
                variant={selectedVariant}
                colors={colors}
                gradients={gradients}
                isDark={isDark}
                onClose={() => setShowRestockModal(false)}
                onSubmit={handleRestock}
            />
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    },
    title: { ...Typography.h2, color: colors.textPrimary, fontWeight: '900' },
    subtitle: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    addBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.glow },
    addBtnGradient: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 12, marginBottom: Spacing.lg },
    statCard: {
        flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.sm,
    },
    statVal: { ...Typography.h3, color: colors.textPrimary, fontWeight: '900' },
    statLabel: { ...Typography.caption, color: colors.textMuted, fontWeight: '700' },

    // Product chips
    chipsRow: { maxHeight: 44, marginBottom: Spacing.sm },
    chipsContainer: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center' },
    productChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    productChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    productChipText: { ...Typography.buttonSm, color: colors.textMuted },

    // Filter row
    filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
    filterTab: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary + '1F', borderColor: colors.primary },
    filterActiveWarn: { backgroundColor: colors.warning + '1A', borderColor: colors.warning },
    filterText: { ...Typography.buttonSm, color: colors.textMuted },
    filterTextActive: { color: colors.primary },

    // List & Cards
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    card: {
        borderRadius: Radius.xl, marginBottom: Spacing.md, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.sm,
    },
    cardGradient: { padding: Spacing.lg },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    cardMeta: { flex: 1 },
    colorDot: { width: 14, height: 14, borderRadius: 7 },
    variantName: { ...Typography.h5, color: colors.textPrimary, fontWeight: '800' },
    variantSub: { ...Typography.body2, color: colors.textMuted },
    skuText: { ...Typography.caption, color: colors.textMuted, marginTop: 4 },
    stockInfo: { alignItems: 'flex-end' },
    stockValue: { ...Typography.h2, fontWeight: '900' },
    unit: { ...Typography.caption, color: colors.textMuted, fontWeight: '700' },
    progressBg: { height: 8, backgroundColor: colors.glass, borderRadius: 4, marginBottom: 20, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { ...Typography.caption, fontWeight: '800', textTransform: 'uppercase' },
    subStockChip: {
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    subStockText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '700' },
    adjustBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 12,
        borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    },
    adjustText: { ...Typography.buttonSm, color: colors.primary, fontWeight: '800' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 12 },
    emptyTitle: { ...Typography.h4, color: colors.textMuted },
    emptySubtitle: { ...Typography.caption, color: colors.textMuted, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    modalSheet: {
        backgroundColor: colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
        padding: Spacing.xxl, paddingBottom: 40,
    },
    modalHandle: {
        width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
        alignSelf: 'center', marginBottom: Spacing.lg,
    },
    modalTitle: { ...Typography.h4, color: colors.textPrimary, fontWeight: '900', marginBottom: 4 },
    modalSubtitle: { ...Typography.body2, color: colors.textMuted, marginBottom: Spacing.xl },
    modalLabel: { ...Typography.caption, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: Spacing.sm },
    modalInput: {
        borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md,
        padding: Spacing.md, color: colors.textPrimary, ...Typography.body1,
        backgroundColor: colors.glass, marginBottom: Spacing.xl,
    },
    targetRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
    targetBtn: {
        flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass,
    },
    targetBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    targetBtnText: { ...Typography.buttonSm, color: colors.textMuted, fontWeight: '800' },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass,
    },
    cancelBtnText: { ...Typography.button, color: colors.textMuted },
    submitBtn: { flex: 2, borderRadius: Radius.md, overflow: 'hidden', ...Shadows.glow },
    submitBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    submitBtnText: { ...Typography.button, color: colors.textInverse, fontWeight: '900' },
});
