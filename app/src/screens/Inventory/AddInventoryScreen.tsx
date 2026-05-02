import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, StatusBar,
    ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { inventoryAPI } from '../../api/inventory';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const CATEGORIES = ['Vegetables', 'Meat', 'Dairy', 'Spices', 'Beverages', 'Packaging'];
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'box'];

export default function AddInventoryScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const [form, setForm] = useState({
        name: '',
        category: 'Vegetables',
        currentStock: '',
        unit: 'kg',
        lowStockThreshold: '',
        costPerUnit: '',
        price: '',
        supplierName: '',
        supplierPhone: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!form.name || !form.currentStock || !form.unit) {
            Alert.alert('Missing Fields', 'Please fill in item name, stock, and unit at minimum.');
            return;
        }

        setIsSaving(true);
        try {
            const numStock = parseFloat(form.currentStock);
            const numLow = form.lowStockThreshold ? parseFloat(form.lowStockThreshold) : numStock * 0.2;
            const numCost = form.costPerUnit ? parseFloat(form.costPerUnit) : 0;

            await inventoryAPI.create({
                name: form.name,
                category: form.category,
                currentStock: numStock,
                unit: form.unit,
                lowStockThreshold: numLow,
                costPerUnit: numCost,
                price: form.price ? parseFloat(form.price) : 0,
                supplierName: form.supplierName,
                supplierPhone: form.supplierPhone
            });

            Alert.alert('Success', `${form.name} added to inventory!`, [
                { text: 'Done', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to add item');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                {/* Header */}
                <View style={themedStyles.header}>
                    <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={themedStyles.headerTitle}>Add Item</Text>
                    <View style={themedStyles.placeholder} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={themedStyles.scroll}>

                        <View style={themedStyles.formCard}>
                            {/* Name */}
                            <Text style={themedStyles.label}>Item Name</Text>
                            <View style={themedStyles.inputWrap}>
                                <Ionicons name="cube-outline" size={20} color={colors.textMuted} style={themedStyles.inputIcon} />
                                <TextInput
                                    style={themedStyles.input}
                                    placeholder="e.g. Tomato, Chicken Breast"
                                    placeholderTextColor={colors.textMuted}
                                    value={form.name}
                                    onChangeText={(t) => setForm({ ...form, name: t })}
                                />
                            </View>

                            {/* Category Selector */}
                            <Text style={themedStyles.label}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={themedStyles.chipRow}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[themedStyles.chip, form.category === cat && themedStyles.chipActive]}
                                        onPress={() => setForm({ ...form, category: cat })}
                                    >
                                        <Text style={[themedStyles.chipText, form.category === cat && themedStyles.chipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Stock & Unit Row */}
                            <View style={themedStyles.row}>
                                <View style={themedStyles.col}>
                                    <Text style={themedStyles.label}>Initial Stock</Text>
                                    <View style={themedStyles.inputWrap}>
                                        <TextInput
                                            style={themedStyles.input}
                                            placeholder="0.0"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.currentStock}
                                            onChangeText={(t) => setForm({ ...form, currentStock: t })}
                                        />
                                    </View>
                                </View>
                                <View style={themedStyles.col}>
                                    <Text style={themedStyles.label}>Unit</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={themedStyles.chipRowSmall}>
                                        {UNITS.map(u => (
                                            <TouchableOpacity
                                                key={u}
                                                style={[themedStyles.chipSmall, form.unit === u && themedStyles.chipActive]}
                                                onPress={() => setForm({ ...form, unit: u })}
                                            >
                                                <Text style={[themedStyles.chipTextSmall, form.unit === u && themedStyles.chipTextActive]}>{u}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Additional Settings */}
                            <View style={themedStyles.row}>
                                <View style={themedStyles.col}>
                                    <Text style={themedStyles.label}>Low Alert At</Text>
                                    <View style={themedStyles.inputWrap}>
                                        <Ionicons name="warning-outline" size={16} color={colors.textMuted} style={themedStyles.inputIcon} />
                                        <TextInput
                                            style={themedStyles.input}
                                            placeholder="Optional"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.lowStockThreshold}
                                            onChangeText={(t) => setForm({ ...form, lowStockThreshold: t })}
                                        />
                                    </View>
                                </View>
                                <View style={themedStyles.col}>
                                    <Text style={themedStyles.label}>Cost / Unit</Text>
                                    <View style={themedStyles.inputWrap}>
                                        <Text style={themedStyles.rupeeIcon}>₹</Text>
                                        <TextInput
                                            style={themedStyles.input}
                                            placeholder="0.00"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.costPerUnit}
                                            onChangeText={(t) => setForm({ ...form, costPerUnit: t })}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={themedStyles.row}>
                                <View style={themedStyles.col}>
                                    <Text style={themedStyles.label}>Selling Price (Retail)</Text>
                                    <View style={themedStyles.inputWrap}>
                                        <Text style={themedStyles.rupeeIcon}>₹</Text>
                                        <TextInput
                                            style={themedStyles.input}
                                            placeholder="0.00"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.price}
                                            onChangeText={(t) => setForm({ ...form, price: t })}
                                        />
                                    </View>
                                </View>
                                <View style={themedStyles.col} />
                            </View>

                            {/* Supplier Details */}
                            <Text style={themedStyles.label}>Supplier Details</Text>
                            <View style={themedStyles.inputWrap}>
                                <Ionicons name="business-outline" size={18} color={colors.textMuted} style={themedStyles.inputIcon} />
                                <TextInput
                                    style={themedStyles.input}
                                    placeholder="Supplier Name"
                                    placeholderTextColor={colors.textMuted}
                                    value={form.supplierName}
                                    onChangeText={(t) => setForm({ ...form, supplierName: t })}
                                />
                            </View>
                            <View style={[themedStyles.inputWrap, { marginTop: 10 }]}>
                                <Ionicons name="call-outline" size={18} color={colors.textMuted} style={themedStyles.inputIcon} />
                                <TextInput
                                    style={themedStyles.input}
                                    placeholder="Supplier Phone"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="phone-pad"
                                    value={form.supplierPhone}
                                    onChangeText={(t) => setForm({ ...form, supplierPhone: t })}
                                />
                            </View>
                        </View>

                    </ScrollView>

                    {/* Footer Save Button */}
                    <View style={themedStyles.footer}>
                        <TouchableOpacity style={themedStyles.saveBtn} activeOpacity={0.9} onPress={handleSubmit} disabled={isSaving}>
                            <LinearGradient colors={gradients.primary} style={themedStyles.saveGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                {isSaving ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                                        <Text style={themedStyles.saveText}>Save Item to Inventory</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    placeholder: { width: 40 },
    scroll: { padding: Spacing.lg },
    formCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...Shadows.sm
    },
    label: { ...Typography.body2, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 50
    },
    inputIcon: { marginRight: 10 },
    rupeeIcon: { color: colors.textMuted, fontSize: 16, marginRight: 8, fontWeight: '600' },
    input: { flex: 1, color: colors.textPrimary, ...Typography.body1 },
    chipRow: { flexDirection: 'row', marginBottom: 6 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
        marginRight: 8, height: 40, justifyContent: 'center'
    },
    chipActive: { backgroundColor: colors.primary + '26', borderColor: colors.primary },
    chipText: { ...Typography.buttonSm, color: colors.textMuted },
    chipTextActive: { color: colors.primary },
    row: { flexDirection: 'row', gap: 16 },
    col: { flex: 1 },
    chipRowSmall: { flexDirection: 'row', marginTop: 4 },
    chipSmall: {
        paddingHorizontal: 12, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
        marginRight: 6, height: 44, justifyContent: 'center'
    },
    chipTextSmall: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 20 },
    saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.glow },
    saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    saveText: { ...Typography.h4, color: colors.white },
});
