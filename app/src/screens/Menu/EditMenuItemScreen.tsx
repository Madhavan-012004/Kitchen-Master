import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMenuStore } from '../../store/useMenuStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const CATEGORIES = ['Starters', 'Mains', 'Breads', 'Beverages', 'Desserts', 'Others'];

export default function EditMenuItemScreen({ navigation, route }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const existingItem = route.params?.item;
    const { addItem, updateItem } = useMenuStore();
    const { user } = useAuthStore();
    const isPoultry = user?.preferredPosMode === 'poultry';

    const [form, setForm] = useState({
        name: existingItem?.name || '',
        category: existingItem?.category || '',
        price: existingItem?.price?.toString() || '',
        description: (existingItem?.description || '').split('||META:')[0],
        isVeg: existingItem?.isVeg ?? true,
        taxRate: existingItem?.taxRate?.toString() || '5',
        buyingPrice: existingItem?.buyingPrice?.toString() || '',
        quantityType: existingItem?.quantityType || 'kg',
        wastage: existingItem?.wastage?.toString() || '0',
        profit: existingItem?.profit?.toString() || '0',
    });
    const [saving, setSaving] = useState(false);
    const [nameFocused, setNameFocused] = useState(false);
    const [descFocused, setDescFocused] = useState(false);

    const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.name || !form.category || !form.price) {
            Alert.alert('Missing Fields', 'Please fill in the name, category, and price.');
            return;
        }
        setSaving(true);
        const payload: any = { ...form, price: parseFloat(form.price), taxRate: parseFloat(form.taxRate) };
        if (isPoultry) {
            payload.buyingPrice = parseFloat(form.buyingPrice) || 0;
            payload.quantityType = form.quantityType;
            const wastage = parseFloat(form.wastage) || 0;
            const profit = parseFloat(form.profit) || 0;
            payload.sellingPrice = +(payload.buyingPrice + (payload.buyingPrice * wastage / 100) + profit).toFixed(2);
            payload.price = payload.sellingPrice;

            // Backend ignores these fields, so we embed them as JSON in the description
            const meta = { buy: payload.buyingPrice, sell: payload.sellingPrice, qty: form.quantityType, wastage, profit };
            payload.description = (form.description || '').split('||META:')[0] + '||META:' + JSON.stringify(meta);
        }
        try {
            if (existingItem) await updateItem(existingItem._id, payload);
            else await addItem(payload);
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally { setSaving(false); }
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={themedStyles.header}>
                        <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={themedStyles.headerTitle}>{existingItem ? 'Edit Dish' : 'New Dish'}</Text>
                        <TouchableOpacity style={themedStyles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                            <LinearGradient colors={saving ? [colors.border, colors.border] : gradients.primary} style={themedStyles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Text style={themedStyles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={themedStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                        {/* Dish Name */}
                        <View style={themedStyles.section}>
                            <Text style={themedStyles.sectionTitle}>Basic Info</Text>
                            <Text style={themedStyles.label}>Dish Name *</Text>
                            <View style={[themedStyles.inputWrapper, nameFocused && themedStyles.inputFocused]}>
                                <TextInput
                                    style={themedStyles.input}
                                    value={form.name}
                                    onChangeText={v => set('name', v)}
                                    placeholder="e.g. Chicken Biryani"
                                    placeholderTextColor={colors.textMuted}
                                    onFocus={() => setNameFocused(true)}
                                    onBlur={() => setNameFocused(false)}
                                />
                            </View>

                            {/* Price & Tax Row */}
                            <View style={themedStyles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={themedStyles.label}>{isPoultry ? 'Selling Price (₹) *' : 'Price (₹) *'}</Text>
                                    <View style={themedStyles.inputWrapper}>
                                        <Text style={themedStyles.currencySymbol}>₹</Text>
                                        <TextInput
                                            style={themedStyles.input}
                                            value={form.price}
                                            onChangeText={v => set('price', v)}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={themedStyles.label}>Tax Rate (%)</Text>
                                    <View style={themedStyles.inputWrapper}>
                                        <TextInput
                                            style={themedStyles.input}
                                            value={form.taxRate}
                                            onChangeText={v => set('taxRate', v)}
                                            keyboardType="numeric"
                                            placeholder="5"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </View>
                            </View>

                            {isPoultry && (
                                <View style={[themedStyles.row, { marginTop: Spacing.md }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={themedStyles.label}>Buying Price (₹)</Text>
                                        <View style={themedStyles.inputWrapper}>
                                            <Text style={themedStyles.currencySymbol}>₹</Text>
                                            <TextInput
                                                style={themedStyles.input}
                                                value={form.buyingPrice}
                                                onChangeText={v => set('buyingPrice', v)}
                                                keyboardType="numeric"
                                                placeholder="0.00"
                                                placeholderTextColor={colors.textMuted}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ width: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={themedStyles.label}>Unit Type</Text>
                                        <View style={[themedStyles.row, { marginTop: 4 }]}>
                                            <TouchableOpacity
                                                style={[themedStyles.catChip, { flex: 1, paddingHorizontal: 0, paddingVertical: 12, justifyContent: 'center' }, form.quantityType === 'kg' && themedStyles.catChipActive]}
                                                onPress={() => set('quantityType', 'kg')}
                                            >
                                                <Text style={[themedStyles.catChipText, form.quantityType === 'kg' && themedStyles.catChipTextActive, { textAlign: 'center' }]}>kg</Text>
                                            </TouchableOpacity>
                                            <View style={{ width: 8 }} />
                                            <TouchableOpacity
                                                style={[themedStyles.catChip, { flex: 1, paddingHorizontal: 0, paddingVertical: 12, justifyContent: 'center' }, form.quantityType === 'pcs' && themedStyles.catChipActive]}
                                                onPress={() => set('quantityType', 'pcs')}
                                            >
                                                <Text style={[themedStyles.catChipText, form.quantityType === 'pcs' && themedStyles.catChipTextActive, { textAlign: 'center' }]}>pcs</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {isPoultry && (
                                <View style={[themedStyles.row, { marginTop: Spacing.md }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={themedStyles.label}>Wastage (%)</Text>
                                        <View style={themedStyles.inputWrapper}>
                                            <TextInput
                                                style={themedStyles.input}
                                                value={form.wastage}
                                                onChangeText={v => set('wastage', v)}
                                                keyboardType="numeric"
                                                placeholder="20"
                                                placeholderTextColor={colors.textMuted}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ width: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={themedStyles.label}>Profit (₹)</Text>
                                        <View style={themedStyles.inputWrapper}>
                                            <TextInput
                                                style={themedStyles.input}
                                                value={form.profit}
                                                onChangeText={v => set('profit', v)}
                                                keyboardType="numeric"
                                                placeholder="60"
                                                placeholderTextColor={colors.textMuted}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {isPoultry && (
                                <View style={{ marginTop: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.1)', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border }}>
                                    <Text style={{ ...Typography.overline, color: colors.textSecondary }}>💰 Calculated Retail Price</Text>
                                    <Text style={{ ...Typography.h3, color: colors.primary, marginTop: 4 }}>
                                        ₹{((parseFloat(form.buyingPrice) || 0) + ((parseFloat(form.buyingPrice) || 0) * (parseFloat(form.wastage) || 0) / 100) + (parseFloat(form.profit) || 0)).toFixed(2)}
                                    </Text>
                                    <Text style={{ ...Typography.caption, color: colors.textMuted }}>Formula: Base + (Base × Wastage%) + Profit</Text>
                                </View>
                            )}
                        </View>

                        {/* Category Selector */}
                        <View style={themedStyles.section}>
                            <Text style={themedStyles.sectionTitle}>Category *</Text>
                            <View style={themedStyles.categoryGrid}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[themedStyles.catChip, form.category === cat && themedStyles.catChipActive]}
                                        onPress={() => set('category', cat)}
                                        activeOpacity={0.8}
                                    >
                                        {form.category === cat && (
                                            <LinearGradient colors={gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />
                                        )}
                                        <Text style={[themedStyles.catChipText, form.category === cat && themedStyles.catChipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Veg / Non-veg Toggle */}
                        <View style={themedStyles.section}>
                            <Text style={themedStyles.sectionTitle}>Food Type</Text>
                            <View style={themedStyles.vegRow}>
                                <TouchableOpacity
                                    style={[themedStyles.vegOption, form.isVeg && themedStyles.vegOptionActive]}
                                    onPress={() => set('isVeg', true)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[themedStyles.vegDot, { borderColor: colors.success || '#00D68F' }]}>
                                        <View style={[themedStyles.vegDotInner, { backgroundColor: colors.success || '#00D68F' }]} />
                                    </View>
                                    <Text style={[themedStyles.vegText, form.isVeg && { color: colors.success || '#00D68F' }]}>Vegetarian</Text>
                                    {form.isVeg && <Ionicons name="checkmark-circle" size={18} color={colors.success || '#00D68F'} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[themedStyles.vegOption, !form.isVeg && themedStyles.nonVegOptionActive]}
                                    onPress={() => set('isVeg', false)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[themedStyles.vegDot, { borderColor: colors.error || '#FF5C7C' }]}>
                                        <View style={[themedStyles.vegDotInner, { backgroundColor: colors.error || '#FF5C7C' }]} />
                                    </View>
                                    <Text style={[themedStyles.vegText, !form.isVeg && { color: colors.error || '#FF5C7C' }]}>Non-Veg</Text>
                                    {!form.isVeg && <Ionicons name="checkmark-circle" size={18} color={colors.error || '#FF5C7C'} />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Description */}
                        <View style={themedStyles.section}>
                            <Text style={themedStyles.sectionTitle}>Description</Text>
                            <View style={[themedStyles.inputWrapper, descFocused && themedStyles.inputFocused, { minHeight: 110, alignItems: 'flex-start', paddingTop: 12 }]}>
                                <TextInput
                                    style={[themedStyles.input, { textAlignVertical: 'top', minHeight: 90 }]}
                                    value={form.description}
                                    onChangeText={v => set('description', v)}
                                    placeholder="Describe the dish... (optional)"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    onFocus={() => setDescFocused(true)}
                                    onBlur={() => setDescFocused(false)}
                                />
                            </View>
                        </View>

                        {existingItem && (
                            <TouchableOpacity style={themedStyles.deleteBtn} activeOpacity={0.8}>
                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                                <Text style={themedStyles.deleteText}>Delete this dish</Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { ...Typography.h4, color: colors.textPrimary },
    saveBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.primary },
    saveBtnGrad: { paddingHorizontal: Spacing.xl, paddingVertical: 10 },
    saveBtnText: { ...Typography.buttonSm, color: colors.white },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    section: {
        backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border,
    },
    sectionTitle: { ...Typography.h5, color: colors.textPrimary, marginBottom: Spacing.md },
    label: { ...Typography.overline, color: colors.textMuted, marginBottom: Spacing.sm },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    inputFocused: { borderColor: colors.primary, backgroundColor: colors.primary + '0F' },
    currencySymbol: { ...Typography.h4, color: colors.primary, marginRight: 4 },
    input: { flex: 1, ...Typography.body1, color: colors.textPrimary, paddingVertical: 14 },
    row: { flexDirection: 'row' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catChip: {
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.round, overflow: 'hidden',
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    catChipActive: { borderColor: colors.primary + '66', ...Shadows.primary },
    catChipText: { ...Typography.buttonSm, color: colors.textMuted },
    catChipTextActive: { color: colors.white },
    vegRow: { flexDirection: 'row', gap: 12 },
    vegOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: Spacing.md, borderRadius: Radius.md,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
    },
    vegOptionActive: { borderColor: (colors.success || '#00D68F') + '66', backgroundColor: (colors.success || '#00D68F') + '14' },
    nonVegOptionActive: { borderColor: (colors.error || '#FF5C7C') + '66', backgroundColor: (colors.error || '#FF5C7C') + '14' },
    vegDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    vegDotInner: { width: 6, height: 6, borderRadius: 2 },
    vegText: { ...Typography.buttonSm, color: colors.textSecondary, flex: 1 },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderWidth: 1, borderColor: colors.error + '40',
        borderRadius: Radius.md, backgroundColor: colors.error + '0F',
    },
    deleteText: { ...Typography.buttonSm, color: colors.error },
});
