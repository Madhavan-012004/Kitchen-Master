import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Modal, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';

interface AdjustStockModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { type: 'add' | 'deduct'; quantity: number; reason: string; totalCost?: number; recordAsExpense?: boolean }) => Promise<void>;
    item: any;
}

export default function AdjustStockModal({ visible, onClose, onSubmit, item }: AdjustStockModalProps) {
    const { colors, gradients, isDark } = useAppTheme();
    const [type, setType] = useState<'add' | 'deduct'>('add');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [recordAsExpense, setRecordAsExpense] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!quantity || !reason) return;
        setIsSubmitting(true);
        try {
            await onSubmit({
                type,
                quantity: parseFloat(quantity),
                reason,
                totalCost: recordAsExpense ? parseFloat(totalCost) : undefined,
                recordAsExpense
            });
            setQuantity('');
            setReason('');
            setTotalCost('');
            setRecordAsExpense(false);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={isDark ? 80 : 40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={styles.container}
                >
                    <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.header}>
                            <View style={styles.headerTitleRow}>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>âš¡ Quick Adjust</Text>
                                <Text style={[styles.itemName, { color: colors.textSecondary }]}>{item.name}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.content}>
                            {/* Action Toggle */}
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Action</Text>
                            <View style={styles.typeRow}>
                                <TouchableOpacity 
                                    style={[
                                        styles.typeBtn, 
                                        { borderColor: colors.border },
                                        type === 'add' && { backgroundColor: colors.success + '26', borderColor: colors.success }
                                    ]}
                                    onPress={() => setType('add')}
                                >
                                    <Ionicons name="add-circle" size={20} color={type === 'add' ? colors.success : colors.textMuted} />
                                    <Text style={[styles.typeText, { color: type === 'add' ? colors.success : colors.textMuted }]}>Receive</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[
                                        styles.typeBtn, 
                                        { borderColor: colors.border },
                                        type === 'deduct' && { backgroundColor: colors.error + '26', borderColor: colors.error }
                                    ]}
                                    onPress={() => setType('deduct')}
                                >
                                    <Ionicons name="remove-circle" size={20} color={type === 'deduct' ? colors.error : colors.textMuted} />
                                    <Text style={[styles.typeText, { color: type === 'deduct' ? colors.error : colors.textMuted }]}>Consume</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Quantity */}
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity ({item.unit})</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.textPrimary }]}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    autoFocus
                                />
                            </View>

                            {/* Reason */}
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Audit Reason</Text>
                            <View style={[styles.inputContainer, styles.textAreaContainer, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, styles.textArea, { color: colors.textPrimary }]}
                                    placeholder="e.g. Regular restock, Spillage, Kitchen usage..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                    value={reason}
                                    onChangeText={setReason}
                                />
                            </View>

                            {/* Expense Automation */}
                            {type === 'add' && (
                                <View style={styles.expenseSection}>
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        style={styles.expenseToggle} 
                                        onPress={() => {
                                            const newState = !recordAsExpense;
                                            setRecordAsExpense(newState);
                                            if (newState) {
                                                const estimated = parseFloat(quantity) * (item.costPerUnit || 0);
                                                setTotalCost(isNaN(estimated) ? '0' : estimated.toString());
                                            }
                                        }}
                                    >
                                        <Ionicons 
                                            name={recordAsExpense ? "checkbox" : "square-outline"} 
                                            size={22} 
                                            color={recordAsExpense ? colors.primary : colors.textMuted} 
                                        />
                                        <Text style={[styles.expenseToggleText, { color: colors.textPrimary }]}>Record as Expenditure</Text>
                                    </TouchableOpacity>

                                    {recordAsExpense && (
                                        <View style={styles.expenseInputs}>
                                            <Text style={[styles.label, { color: colors.textSecondary }]}>Total Amount Paid (â‚¹)</Text>
                                            <View style={[styles.inputContainer, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                                <TextInput
                                                    style={[styles.input, { color: colors.textPrimary }]}
                                                    placeholder="0.00"
                                                    keyboardType="numeric"
                                                    value={totalCost}
                                                    onChangeText={setTotalCost}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={[styles.submitBtn, (!quantity || !reason) && { opacity: 0.5 }]} 
                                onPress={handleSubmit}
                                disabled={isSubmitting || !quantity || !reason}
                            >
                                <LinearGradient 
                                    colors={gradients.primary} 
                                    style={styles.submitGradient}
                                    start={{ x: 0, y: 0 }} 
                                    end={{ x: 1, y: 0 }}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.submitText}>Apply Adjustment</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    container: {
        width: '100%',
        alignItems: 'center',
    },
    modal: {
        width: '100%',
        borderRadius: Radius.xl,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    header: {
        padding: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitleRow: {
        flex: 1,
    },
    title: {
        ...Typography.h4,
        fontWeight: '900',
    },
    itemName: {
        ...Typography.caption,
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    label: {
        ...Typography.caption,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 16,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    typeText: {
        ...Typography.buttonSm,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: Radius.md,
        paddingHorizontal: 16,
        height: 54,
    },
    input: {
        flex: 1,
        ...Typography.h4,
        fontWeight: '600',
    },
    textAreaContainer: {
        height: 100,
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    textArea: {
        ...Typography.body1,
        textAlignVertical: 'top',
        height: '100%',
    },
    footer: {
        padding: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 16,
    },
    cancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    cancelText: {
        ...Typography.button,
        fontWeight: '700',
    },
    submitBtn: {
        borderRadius: Radius.md,
        overflow: 'hidden',
        minWidth: 160,
    },
    submitGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        ...Typography.button,
        color: '#fff',
        fontWeight: '900',
    },
    expenseSection: {
        marginTop: 16,
        padding: 12,
        borderRadius: Radius.md,
        backgroundColor: '#f8fafc20',
        borderWidth: 1,
        borderColor: '#e2e8f020',
    },
    expenseToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    expenseToggleText: {
        ...Typography.body2,
        fontWeight: '700',
    },
    expenseInputs: {
        marginTop: 12,
    }
});

