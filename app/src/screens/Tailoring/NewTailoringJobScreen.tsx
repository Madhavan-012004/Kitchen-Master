import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, StatusBar, Alert, ActivityIndicator, Modal, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createTailoringJob } from '../../api/clothing';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

// ── Measurement fields ────────────────────────────────────────────────────────
const MEASUREMENT_FIELDS = [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'sleeve', label: 'Sleeve' },
    { key: 'length', label: 'Length' },
    { key: 'neck', label: 'Neck' },
    { key: 'inseam', label: 'Inseam' },
] as const;

type MeasurementKey = typeof MEASUREMENT_FIELDS[number]['key'];

// ── Token Success Modal ───────────────────────────────────────────────────────
function TokenSuccessModal({
    visible,
    token,
    colors,
    gradients,
    isDark,
    onClose,
}: {
    visible: boolean;
    token: string;
    colors: any;
    gradients: any;
    isDark: boolean;
    onClose: () => void;
}) {
    const handleShare = async () => {
        try {
            await Share.share({
                message: `Your tailoring job token is: #${token}\nPlease keep this safe to track your order.`,
            });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.successOverlay}>
                <View style={[styles.successSheet, { backgroundColor: colors.surface }]}>
                    {/* Icon */}
                    <LinearGradient colors={gradients.success} style={styles.successIcon}>
                        <Ionicons name="checkmark" size={40} color="#fff" />
                    </LinearGradient>

                    <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Job Created!</Text>
                    <Text style={[styles.successSub, { color: colors.textMuted }]}>
                        Share this token with the customer
                    </Text>

                    {/* Token Display */}
                    <View style={[styles.tokenBox, { backgroundColor: colors.glass, borderColor: colors.primary }]}>
                        <Ionicons name="pricetag" size={20} color={colors.primary} />
                        <Text style={[styles.tokenNumber, { color: colors.primary }]}>#{token}</Text>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                        <LinearGradient colors={gradients.primary} style={styles.shareBtnGrad}>
                            <Ionicons name="share-social-outline" size={18} color={colors.textInverse} />
                            <Text style={[styles.shareBtnText, { color: colors.textInverse }]}>Share Token</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.doneBtn, { borderColor: colors.border }]} onPress={onClose}>
                        <Text style={[styles.doneBtnText, { color: colors.textMuted }]}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ── Form Input ────────────────────────────────────────────────────────────────
function FormInput({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    multiline = false,
    colors,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    keyboardType?: any;
    multiline?: boolean;
    colors: any;
}) {
    return (
        <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.glass },
                    multiline && styles.inputMulti,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={keyboardType}
                multiline={multiline}
                numberOfLines={multiline ? 3 : 1}
                textAlignVertical={multiline ? 'top' : 'center'}
            />
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NewTailoringJobScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();

    // Customer
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [material, setMaterial] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [advancePaid, setAdvancePaid] = useState('');
    const [specialNotes, setSpecialNotes] = useState('');

    // Measurements
    const [measurements, setMeasurements] = useState<Record<MeasurementKey, string>>(
        MEASUREMENT_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as Record<MeasurementKey, string>)
    );

    const [submitting, setSubmitting] = useState(false);
    const [successToken, setSuccessToken] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!customerName.trim()) {
            Alert.alert('Required', 'Please enter the customer name.');
            return;
        }
        if (!customerPhone.trim()) {
            Alert.alert('Required', 'Please enter the customer phone number.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                material: material.trim(),
                deliveryDate: deliveryDate.trim() || undefined,
                measurements,
                totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
                advancePaid: advancePaid ? parseFloat(advancePaid) : undefined,
                specialNotes: specialNotes.trim() || undefined,
            };

            const res = await createTailoringJob(payload);
            const token = res.data.data?.token || res.data.data?.job?.token || '';
            setSuccessToken(token);
            setShowSuccess(true);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.response?.data?.message || 'Failed to create tailoring job.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        navigation.goBack();
    };

    return (
        <LinearGradient colors={gradients.background} style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe} edges={['top']}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.glass }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Tailoring Job</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Customer Details ─────────────────────────────────── */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Customer Details
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <FormInput
                            label="Customer Name *"
                            value={customerName}
                            onChangeText={setCustomerName}
                            placeholder="e.g. Ravi Kumar"
                            colors={colors}
                        />
                        <FormInput
                            label="Phone Number *"
                            value={customerPhone}
                            onChangeText={setCustomerPhone}
                            placeholder="e.g. 9876543210"
                            keyboardType="phone-pad"
                            colors={colors}
                        />
                        <FormInput
                            label="Material Description"
                            value={material}
                            onChangeText={setMaterial}
                            placeholder="e.g. Cotton fabric, blue stripes"
                            multiline
                            colors={colors}
                        />
                        <FormInput
                            label="Delivery Date (DD/MM/YYYY)"
                            value={deliveryDate}
                            onChangeText={setDeliveryDate}
                            placeholder="e.g. 25/12/2026"
                            colors={colors}
                        />
                    </View>

                    {/* ── Measurements ─────────────────────────────────────── */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Measurements (in inches)
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.measureGrid}>
                            {MEASUREMENT_FIELDS.map(field => (
                                <View key={field.key} style={styles.measureCell}>
                                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                                        {field.label}
                                    </Text>
                                    <TextInput
                                        style={[
                                            styles.measureInput,
                                            { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.glass },
                                        ]}
                                        value={measurements[field.key]}
                                        onChangeText={v =>
                                            setMeasurements(prev => ({ ...prev, [field.key]: v }))
                                        }
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ── Payment ───────────────────────────────────────────── */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Payment
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <FormInput
                            label="Total Amount (₹)"
                            value={totalAmount}
                            onChangeText={setTotalAmount}
                            placeholder="e.g. 1500"
                            keyboardType="numeric"
                            colors={colors}
                        />
                        <FormInput
                            label="Advance Paid (₹)"
                            value={advancePaid}
                            onChangeText={setAdvancePaid}
                            placeholder="e.g. 500"
                            keyboardType="numeric"
                            colors={colors}
                        />
                    </View>

                    {/* ── Special Notes ─────────────────────────────────────── */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Special Notes
                    </Text>
                    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <FormInput
                            label="Notes"
                            value={specialNotes}
                            onChangeText={setSpecialNotes}
                            placeholder="Any special instructions..."
                            multiline
                            colors={colors}
                        />
                    </View>

                    {/* ── Submit ────────────────────────────────────────────── */}
                    <TouchableOpacity
                        style={[styles.submitBtn, Shadows.glow]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={gradients.primary} style={styles.submitBtnGrad}>
                            {submitting ? (
                                <ActivityIndicator color={colors.textInverse} />
                            ) : (
                                <>
                                    <Ionicons name="cut" size={20} color={colors.textInverse} />
                                    <Text style={[styles.submitBtnText, { color: colors.textInverse }]}>
                                        Create Job
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            <TokenSuccessModal
                visible={showSuccess}
                token={successToken}
                colors={colors}
                gradients={gradients}
                isDark={isDark}
                onClose={handleSuccessClose}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: {
        width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center',
        justifyContent: 'center', borderWidth: 1,
    },
    headerTitle: { ...Typography.h4, fontWeight: '900' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
    sectionTitle: { ...Typography.h5, fontWeight: '900', marginTop: Spacing.xl, marginBottom: Spacing.sm },
    section: {
        borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg,
        gap: Spacing.xs,
    },

    // Form inputs
    inputGroup: { marginBottom: Spacing.sm },
    inputLabel: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    input: {
        borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm, ...Typography.body2,
    },
    inputMulti: { minHeight: 72, paddingTop: Spacing.sm },

    // Measurements grid
    measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    measureCell: { width: '47%' },
    measureInput: {
        borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm, ...Typography.body2, textAlign: 'center',
    },

    // Submit
    submitBtn: { borderRadius: Radius.xl, overflow: 'hidden', marginTop: Spacing.xxl },
    submitBtnGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 18, gap: 10,
    },
    submitBtnText: { ...Typography.button, fontWeight: '900' },

    // Success Modal
    successOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: Spacing.xl },
    successSheet: {
        width: '100%', borderRadius: Radius.xxl, padding: Spacing.xxl,
        alignItems: 'center', ...Shadows.lg,
    },
    successIcon: {
        width: 80, height: 80, borderRadius: 40,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
    },
    successTitle: { ...Typography.h3, fontWeight: '900', marginBottom: 8 },
    successSub: { ...Typography.body2, textAlign: 'center', marginBottom: Spacing.xl },
    tokenBox: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 24, paddingVertical: 16,
        borderRadius: Radius.xl, borderWidth: 2, marginBottom: Spacing.xxl,
    },
    tokenNumber: { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
    shareBtn: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, ...Shadows.glow },
    shareBtnGrad: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, gap: 8,
    },
    shareBtnText: { ...Typography.button, fontWeight: '900' },
    doneBtn: {
        width: '100%', paddingVertical: 14, borderRadius: Radius.xl, alignItems: 'center',
        borderWidth: 1,
    },
    doneBtnText: { ...Typography.button },
});
