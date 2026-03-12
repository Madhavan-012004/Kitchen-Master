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
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

const CATEGORIES = ['Vegetables', 'Meat', 'Dairy', 'Spices', 'Beverages', 'Packaging'];
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'box'];

export default function AddInventoryScreen({ navigation }: any) {
    const [form, setForm] = useState({
        name: '',
        category: 'Vegetables',
        currentStock: '',
        unit: 'kg',
        lowStockThreshold: '',
        costPerUnit: ''
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
                supplier: 'General Vendor'
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
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Item</Text>
                    <View style={styles.placeholder} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                        <View style={styles.formCard}>
                            <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFill} />

                            {/* Name */}
                            <Text style={styles.label}>Item Name</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="cube-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Tomato, Chicken Breast"
                                    placeholderTextColor={Colors.textMuted}
                                    value={form.name}
                                    onChangeText={(t) => setForm({ ...form, name: t })}
                                />
                            </View>

                            {/* Category Selector */}
                            <Text style={styles.label}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.chip, form.category === cat && styles.chipActive]}
                                        onPress={() => setForm({ ...form, category: cat })}
                                    >
                                        <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Stock & Unit Row */}
                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Initial Stock</Text>
                                    <View style={styles.inputWrap}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0.0"
                                            placeholderTextColor={Colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.currentStock}
                                            onChangeText={(t) => setForm({ ...form, currentStock: t })}
                                        />
                                    </View>
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Unit</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRowSmall}>
                                        {UNITS.map(u => (
                                            <TouchableOpacity
                                                key={u}
                                                style={[styles.chipSmall, form.unit === u && styles.chipActive]}
                                                onPress={() => setForm({ ...form, unit: u })}
                                            >
                                                <Text style={[styles.chipTextSmall, form.unit === u && styles.chipTextActive]}>{u}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Additional Settings */}
                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Low Alert At</Text>
                                    <View style={styles.inputWrap}>
                                        <Ionicons name="warning-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Optional"
                                            placeholderTextColor={Colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.lowStockThreshold}
                                            onChangeText={(t) => setForm({ ...form, lowStockThreshold: t })}
                                        />
                                    </View>
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Cost / Unit</Text>
                                    <View style={styles.inputWrap}>
                                        <Text style={styles.rupeeIcon}>₹</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0.00"
                                            placeholderTextColor={Colors.textMuted}
                                            keyboardType="numeric"
                                            value={form.costPerUnit}
                                            onChangeText={(t) => setForm({ ...form, costPerUnit: t })}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                    </ScrollView>

                    {/* Footer Save Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={handleSubmit} disabled={isSaving}>
                            <LinearGradient colors={['#FF8A5C', '#FF6B35', '#E55A24']} style={styles.saveGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                {isSaving ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                                        <Text style={styles.saveText}>Save Item to Inventory</Text>
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, paddingBottom: 20 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    placeholder: { width: 40 },
    scroll: { padding: Spacing.lg },
    formCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', ...Shadows.sm
    },
    label: { ...Typography.body2, color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, height: 50
    },
    inputIcon: { marginRight: 10 },
    rupeeIcon: { color: Colors.textMuted, fontSize: 16, marginRight: 8, fontWeight: '600' },
    input: { flex: 1, color: Colors.textPrimary, ...Typography.body1 },
    chipRow: { flexDirection: 'row', marginBottom: 6 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.round,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
        marginRight: 8, height: 40, justifyContent: 'center'
    },
    chipActive: { backgroundColor: 'rgba(255,107,53,0.15)', borderColor: Colors.primary },
    chipText: { ...Typography.buttonSm, color: Colors.textMuted },
    chipTextActive: { color: Colors.primary },
    row: { flexDirection: 'row', gap: 16 },
    col: { flex: 1 },
    chipRowSmall: { flexDirection: 'row', marginTop: 4 },
    chipSmall: {
        paddingHorizontal: 12, borderRadius: Radius.round,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
        marginRight: 6, height: 44, justifyContent: 'center'
    },
    chipTextSmall: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.glow },
    saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    saveText: { ...Typography.h4, color: Colors.white },
});
