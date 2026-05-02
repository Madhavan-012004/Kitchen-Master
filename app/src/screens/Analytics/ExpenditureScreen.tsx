import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, StatusBar,
    ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import apiClient from '../../api/client';

const CATEGORIES = ['Maintenance', 'Rent', 'Electricity', 'Water', 'Salary', 'Marketing', 'Others'];

export default function ExpenditureScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    
    const [form, setForm] = useState({
        amount: '',
        category: 'Maintenance',
        description: '',
        paymentMethod: 'Cash',
        date: new Date().toISOString().split('T')[0]
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!form.amount || !form.description) {
            Alert.alert('Incomplete Form', 'Please enter an amount and description.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...form,
                amount: parseFloat(form.amount),
                date: new Date().toISOString() // Current time for logging
            };
            await apiClient.post('/transactions', payload);
            Alert.alert('Success', 'Expenditure recorded successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to save expenditure.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                <View style={themedStyles.header}>
                    <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={themedStyles.headerTitle}>Record Expense</Text>
                    <View style={themedStyles.placeholder} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={themedStyles.scroll}>
                        
                        <View style={themedStyles.card}>
                            <Text style={themedStyles.label}>Amount Paid (₹)</Text>
                            <View style={themedStyles.amountInputWrap}>
                                <Text style={themedStyles.currency}>₹</Text>
                                <TextInput
                                    style={themedStyles.amountInput}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={form.amount}
                                    onChangeText={(t) => setForm({ ...form, amount: t })}
                                    autoFocus
                                />
                            </View>

                            <Text style={themedStyles.label}>Category</Text>
                            <View style={themedStyles.categoryRow}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity 
                                        key={cat}
                                        style={[themedStyles.catBtn, form.category === cat && themedStyles.catBtnActive]}
                                        onPress={() => setForm({...form, category: cat})}
                                    >
                                        <Text style={[themedStyles.catText, form.category === cat && themedStyles.catTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={themedStyles.label}>Payment Method</Text>
                            <View style={themedStyles.paymentRow}>
                                {['Cash', 'UPI', 'Card', 'Bank'].map(method => (
                                    <TouchableOpacity 
                                        key={method}
                                        style={[themedStyles.payBtn, form.paymentMethod === method && themedStyles.payBtnActive]}
                                        onPress={() => setForm({...form, paymentMethod: method})}
                                    >
                                        <Text style={[themedStyles.payText, form.paymentMethod === method && themedStyles.payTextActive]}>{method}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={themedStyles.label}>Description / Reason</Text>
                            <View style={themedStyles.textareaWrap}>
                                <TextInput
                                    style={themedStyles.textarea}
                                    placeholder="e.g. A/C Servicing, Floor repair..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    value={form.description}
                                    onChangeText={(t) => setForm({ ...form, description: t })}
                                />
                            </View>
                        </View>

                    </ScrollView>

                    <View style={themedStyles.footer}>
                        <TouchableOpacity style={themedStyles.saveBtn} activeOpacity={0.9} onPress={handleSubmit} disabled={isSaving}>
                            <LinearGradient colors={gradients.primary} style={themedStyles.saveGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                {isSaving ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <>
                                        <Ionicons name="receipt-outline" size={20} color={colors.white} />
                                        <Text style={themedStyles.saveText}>Log Expenditure</Text>
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
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { ...Typography.h3, color: colors.textPrimary, fontWeight: '900' },
    placeholder: { width: 40 },
    scroll: { padding: Spacing.lg },
    card: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, ...Shadows.sm
    },
    label: { ...Typography.caption, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },
    amountInputWrap: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass,
        borderBottomWidth: 2, borderBottomColor: colors.primary, paddingHorizontal: 12, height: 70
    },
    currency: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, marginRight: 10 },
    amountInput: { flex: 1, fontSize: 32, fontWeight: '900', color: colors.textPrimary },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
    catBtnActive: { backgroundColor: colors.primary + '26', borderColor: colors.primary },
    catText: { ...Typography.body2, color: colors.textMuted, fontWeight: '700' },
    catTextActive: { color: colors.primary },
    paymentRow: { flexDirection: 'row', gap: 10 },
    payBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
    payBtnActive: { backgroundColor: colors.success + '26', borderColor: colors.success },
    payText: { ...Typography.buttonSm, color: colors.textMuted },
    payTextActive: { color: colors.success },
    textareaWrap: { backgroundColor: colors.glass, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 120 },
    textarea: { color: colors.textPrimary, fontSize: 16, textAlignVertical: 'top' },
    footer: { padding: Spacing.lg },
    saveBtn: { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.glow },
    saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    saveText: { ...Typography.h4, color: colors.white, fontWeight: '900' },
});
