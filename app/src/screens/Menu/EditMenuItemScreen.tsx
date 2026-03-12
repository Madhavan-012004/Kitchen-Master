import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView,
    TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMenuStore } from '../../store/useMenuStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

const CATEGORIES = ['Starters', 'Mains', 'Breads', 'Beverages', 'Desserts', 'Others'];

export default function EditMenuItemScreen({ navigation, route }: any) {
    const existingItem = route.params?.item;
    const { addItem, updateItem } = useMenuStore();

    const [form, setForm] = useState({
        name: existingItem?.name || '',
        category: existingItem?.category || '',
        price: existingItem?.price?.toString() || '',
        description: existingItem?.description || '',
        isVeg: existingItem?.isVeg ?? true,
        taxRate: existingItem?.taxRate?.toString() || '5',
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
        const payload = { ...form, price: parseFloat(form.price), taxRate: parseFloat(form.taxRate) };
        try {
            if (existingItem) await updateItem(existingItem._id, payload);
            else await addItem(payload);
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally { setSaving(false); }
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{existingItem ? 'Edit Dish' : 'New Dish'}</Text>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                            <LinearGradient colors={saving ? ['#666', '#444'] : ['#FF8A5C', '#FF6B35']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                        {/* Dish Name */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Basic Info</Text>
                            <Text style={styles.label}>Dish Name *</Text>
                            <View style={[styles.inputWrapper, nameFocused && styles.inputFocused]}>
                                <TextInput
                                    style={styles.input}
                                    value={form.name}
                                    onChangeText={v => set('name', v)}
                                    placeholder="e.g. Chicken Biryani"
                                    placeholderTextColor={Colors.textMuted}
                                    onFocus={() => setNameFocused(true)}
                                    onBlur={() => setNameFocused(false)}
                                />
                            </View>

                            {/* Price & Tax Row */}
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Price (₹) *</Text>
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.currencySymbol}>₹</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={form.price}
                                            onChangeText={v => set('price', v)}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor={Colors.textMuted}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Tax Rate (%)</Text>
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={styles.input}
                                            value={form.taxRate}
                                            onChangeText={v => set('taxRate', v)}
                                            keyboardType="numeric"
                                            placeholder="5"
                                            placeholderTextColor={Colors.textMuted}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Category Selector */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Category *</Text>
                            <View style={styles.categoryGrid}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.catChip, form.category === cat && styles.catChipActive]}
                                        onPress={() => set('category', cat)}
                                        activeOpacity={0.8}
                                    >
                                        {form.category === cat && (
                                            <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={[StyleSheet.absoluteFill, { borderRadius: Radius.round }]} />
                                        )}
                                        <Text style={[styles.catChipText, form.category === cat && styles.catChipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Veg / Non-veg Toggle */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Food Type</Text>
                            <View style={styles.vegRow}>
                                <TouchableOpacity
                                    style={[styles.vegOption, form.isVeg && styles.vegOptionActive]}
                                    onPress={() => set('isVeg', true)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.vegDot, { borderColor: Colors.accentGreen }]}>
                                        <View style={[styles.vegDotInner, { backgroundColor: Colors.accentGreen }]} />
                                    </View>
                                    <Text style={[styles.vegText, form.isVeg && { color: Colors.accentGreen }]}>Vegetarian</Text>
                                    {form.isVeg && <Ionicons name="checkmark-circle" size={18} color={Colors.accentGreen} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.vegOption, !form.isVeg && styles.nonVegOptionActive]}
                                    onPress={() => set('isVeg', false)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.vegDot, { borderColor: Colors.error }]}>
                                        <View style={[styles.vegDotInner, { backgroundColor: Colors.error }]} />
                                    </View>
                                    <Text style={[styles.vegText, !form.isVeg && { color: Colors.error }]}>Non-Veg</Text>
                                    {!form.isVeg && <Ionicons name="checkmark-circle" size={18} color={Colors.error} />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Description */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <View style={[styles.inputWrapper, descFocused && styles.inputFocused, { minHeight: 110, alignItems: 'flex-start', paddingTop: 12 }]}>
                                <TextInput
                                    style={[styles.input, { textAlignVertical: 'top', minHeight: 90 }]}
                                    value={form.description}
                                    onChangeText={v => set('description', v)}
                                    placeholder="Describe the dish... (optional)"
                                    placeholderTextColor={Colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    onFocus={() => setDescFocused(true)}
                                    onBlur={() => setDescFocused(false)}
                                />
                            </View>
                        </View>

                        {existingItem && (
                            <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8}>
                                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                <Text style={styles.deleteText}>Delete this dish</Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    headerTitle: { ...Typography.h4, color: Colors.textPrimary },
    saveBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.primary },
    saveBtnGrad: { paddingHorizontal: Spacing.xl, paddingVertical: 10 },
    saveBtnText: { ...Typography.buttonSm, color: Colors.white },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
    section: {
        backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    sectionTitle: { ...Typography.h5, color: Colors.textPrimary, marginBottom: Spacing.md },
    label: { ...Typography.overline, color: Colors.textMuted, marginBottom: Spacing.sm },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.glass, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    inputFocused: { borderColor: Colors.primary, backgroundColor: 'rgba(255,107,53,0.06)' },
    currencySymbol: { ...Typography.h4, color: Colors.primary, marginRight: 4 },
    input: { flex: 1, ...Typography.body1, color: Colors.textPrimary, paddingVertical: 14 },
    row: { flexDirection: 'row' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catChip: {
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.round, overflow: 'hidden',
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    },
    catChipActive: { borderColor: 'rgba(255,107,53,0.4)', ...Shadows.primary },
    catChipText: { ...Typography.buttonSm, color: Colors.textMuted },
    catChipTextActive: { color: Colors.white },
    vegRow: { flexDirection: 'row', gap: 12 },
    vegOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: Spacing.md, borderRadius: Radius.md,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    },
    vegOptionActive: { borderColor: 'rgba(0,214,143,0.4)', backgroundColor: 'rgba(0,214,143,0.08)' },
    nonVegOptionActive: { borderColor: 'rgba(255,92,124,0.4)', backgroundColor: 'rgba(255,92,124,0.08)' },
    vegDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    vegDotInner: { width: 6, height: 6, borderRadius: 2 },
    vegText: { ...Typography.buttonSm, color: Colors.textSecondary, flex: 1 },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,92,124,0.25)',
        borderRadius: Radius.md, backgroundColor: 'rgba(255,92,124,0.06)',
    },
    deleteText: { ...Typography.buttonSm, color: Colors.error },
});
