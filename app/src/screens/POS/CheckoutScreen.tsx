import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    StatusBar, Alert, ScrollView, ActivityIndicator, TextInput,
    Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/useCartStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import api from '../../api/client';
import { useMenuStore } from '../../store/useMenuStore';
import { useSocket } from '../../hooks/useSocket';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';

const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: 'cash-outline' },
    { id: 'card', label: 'Card', icon: 'card-outline' },
    { id: 'upi', label: 'UPI / QR', icon: 'qr-code-outline' },
];

export default function CheckoutScreen({ route, navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const styles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const { i18n } = useTranslation();

    const { 
        items, getTotal, getTaxAmount, getSubtotal, removeItem, updateQuantity, 
        clearCart, tableNumber, orderId, orderNotes, setOrderNotes, addItem,
        extraCharges, setExtraCharges, getExtraChargesTotal, getDiscountAmount,
        discountType, discountValue, orderCreatedAt
    } = useCartStore();
    const { items: allMenuItems } = useMenuStore();
    const [selectedPayment, setSelectedPayment] = useState<string>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPayment, setShowPayment] = useState(route.params?.showPayment || false);
    const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
    const [customChargeName, setCustomChargeName] = useState('');
    const [customChargeAmount, setCustomChargeAmount] = useState('');

    const socket = useSocket();

    // Real-time item status updates
    useEffect(() => {
        if (!socket || !orderId) return;

        const handleItemUpdate = (data: any) => {
            if (data.orderId === orderId) {
                const cartItems = useCartStore.getState().items;
                const itemIndex = cartItems.findIndex(i => i._id === data.itemId);
                if (itemIndex > -1) {
                    const updatedItems = [...cartItems];
                    updatedItems[itemIndex] = { ...updatedItems[itemIndex], status: data.status };
                    useCartStore.setState({ items: updatedItems });
                }
            }
        };

        socket.on('kot:itemUpdate', handleItemUpdate);
        return () => {
            socket.off('kot:itemUpdate', handleItemUpdate);
        };
    }, [socket, orderId]);

    // Combine State
    const [showCombineModal, setShowCombineModal] = useState(false);
    const [combineTargetTable, setCombineTargetTable] = useState('');
    const [activeTables, setActiveTables] = useState<any[]>([]);

    const fetchActiveTablesForCombine = async () => {
        try {
            const response = await api.get('/orders?paymentStatus=unpaid&limit=100');
            const tables = response.data.data.orders.filter((o: any) => o._id !== orderId);
            setActiveTables(tables);
            setShowCombineModal(true);
        } catch (error) {
            Alert.alert('Error', 'Could not fetch active tables for combining.');
        }
    };


    const handleCombineOrder = async () => {
        if (!combineTargetTable) {
            return Alert.alert('Error', 'Please select a target table to combine with.');
        }

        setIsProcessing(true);
        try {
            const targetOrder = activeTables.find(t => t.tableNumber === combineTargetTable);
            await api.post('/orders/combine-tables', {
                sourceTable: tableNumber,
                targetOrderId: targetOrder ? targetOrder._id : null,
                targetTable: combineTargetTable
            });
            Alert.alert('Success', 'Orders combined successfully', [
                { text: 'OK', onPress: () => { clearCart(); navigation.navigate('Tables'); } }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to combine orders');
        } finally {
            setIsProcessing(false);
            setShowCombineModal(false);
        }
    };


    const handleAction = async (actionType: 'kot' | 'pay') => {
        setIsProcessing(true);
        try {
            const orderPayload = {
                items,
                tableNumber,
                subtotal: getSubtotal(),
                taxAmount: getTaxAmount(),
                discountType,
                discountValue,
                discountAmount: getDiscountAmount(),
                extraCharges,
                total: getTotal(),
                paymentMethod: actionType === 'pay' ? selectedPayment : 'pending',
                status: actionType === 'pay' ? 'paid' : 'preparing',
                notes: orderNotes,
            };

            if (orderId) {
                await api.put(`/orders/${orderId}`, orderPayload);
                if (actionType === 'pay') {
                    await api.patch(`/orders/${orderId}/status`, {
                        status: 'paid',
                        paymentStatus: 'paid',
                        paymentMethod: selectedPayment,
                        billRequested: true
                    });
                }
            } else {
                await api.post('/orders', orderPayload);
            }

            setIsProcessing(false);
            if (actionType === 'pay') {
                Alert.alert('Payment Successful 🎉', 'Order has been paid and closed.', [{ text: 'OK', onPress: () => { clearCart(); navigation.navigate('Tables'); } }]);
            } else {
                Alert.alert('KOT Sent 🍳', 'Kitchen has been notified.', [{ text: 'OK', onPress: () => { clearCart(); navigation.navigate('Tables'); } }]);
            }
        } catch (error) {
            console.error('Checkout failed:', error);
            setIsProcessing(false);
            Alert.alert('Error', 'Failed to process order.');
        }
    };

    const handleMarkServed = async (item: any) => {
        if (!orderId || !item._id) return;
        try {
            await api.patch(`/orders/${orderId}/items/${item._id}/status`, { status: 'SERVED' });
            useCartStore.getState().markItemServed(item._id);
        } catch (error) {
            console.error('Failed to mark item as served:', error);
            Alert.alert('Error', 'Could not update item status.');
        }
    };

    const handleServeAll = async () => {
        if (!orderId) return;
        const readyItems = items.filter(i => i.status?.toUpperCase() === 'READY');
        if (readyItems.length === 0) return;

        setIsProcessing(true);
        try {
            const itemIds = readyItems.map(i => i._id);
            await api.patch(`/orders/${orderId}/items/status`, { 
                itemIds, 
                status: 'SERVED' 
            });
            useCartStore.getState().markAllServed();
            Toast.show({ type: 'success', text1: 'Success', text2: 'All ready items marked as served' });
        } catch (error) {
            console.error('Failed to serve all items:', error);
            Alert.alert('Error', 'Could not serve all items.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderCartItem = ({ item }: any) => {
        const isReady = item.status?.toUpperCase() === 'READY' || item.status?.toUpperCase() === 'SERVED';
        const isSent = item._id ? true : false;
        
        // 3-Minute Rule logic
        let isLocked = false;
        if (isSent && orderCreatedAt) {
            const created = new Date(orderCreatedAt).getTime();
            const now = new Date().getTime();
            if (now - created > 180000) { // 3 minutes
                isLocked = true;
            }
        }

        return (
            <View style={styles.cartItemRow}>
                <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                        <Text style={styles.itemName} numberOfLines={1}>
                            {(i18n.language === 'ta' && (item.tamilName || item.menuItem?.tamilName)) ? (item.tamilName || item.menuItem?.tamilName) : item.name}
                        </Text>
                        {isReady && (
                            <View style={[styles.readyBadge, item.status?.toUpperCase() === 'SERVED' && { backgroundColor: colors.success + '26', borderColor: colors.success + '4D' }]}>
                                <Ionicons name="checkmark-done" size={12} color={colors.success} />
                                <Text style={[styles.readyBadgeText, { color: colors.success }]}>
                                    {item.status?.toUpperCase() === 'SERVED' ? 'Served' : 'Ready'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.itemPrice}>₹{item.price}</Text>

                    {item.addedByName && (
                        <Text style={styles.itemAddedByText}>Added by: {item.addedByName}</Text>
                    )}
                    {item.notes ? (
                        <Text style={styles.itemNotesInfo}>Note: {item.notes}</Text>
                    ) : null}
                </View>

                {!isReady ? (
                    <View style={styles.qtyControls}>
                        <TouchableOpacity
                            style={[styles.qtyBtn, isLocked && { opacity: 0.5 }]}
                            disabled={isLocked}
                            onPress={() => {
                                if (item.quantity === 1) removeItem(item._id || item.menuItemId);
                                else updateQuantity(item._id || item.menuItemId, item.quantity - 1);
                            }}
                        >
                            <Ionicons name="remove" size={16} color={colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(item._id || item.menuItemId, item.quantity + 1)}
                        >
                            <Ionicons name="add" size={16} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.qtyControlsStatic}>
                        {item.status?.toUpperCase() === 'READY' ? (
                            <TouchableOpacity style={styles.serveBtn} onPress={() => handleMarkServed(item)}>
                                <Text style={styles.serveBtnText}>Serve</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.qtyTextStatic}>{item.quantity}x</Text>
                        )}
                    </View>
                )}

                <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>
            </View>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{showPayment ? 'Settle Bill' : 'Review Order'}</Text>
                    <TouchableOpacity style={styles.clearBtn} onPress={() => { clearCart(); navigation.goBack(); }}>
                        <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Content */}
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {items.length === 0 ? (
                        <View style={styles.emptyWrap}>
                            <Ionicons name="cart-outline" size={60} color={colors.textMuted} />
                            <Text style={styles.emptyText}>Order is empty</Text>
                        </View>
                    ) : (
                        <View style={styles.orderContainer}>
                            <View style={styles.receiptCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Order Items</Text>
                                    {items.filter(i => i.status?.toUpperCase() === 'READY').length > 0 && (
                                        <TouchableOpacity style={styles.serveAllBtn} onPress={handleServeAll}>
                                            <Ionicons name="checkmark-done-circle" size={16} color={colors.white} />
                                            <Text style={styles.serveAllBtnText}>Serve All Ready</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {items.map((item, idx) => <React.Fragment key={item._id || `cart-${idx}`}>{renderCartItem({ item })}</React.Fragment>)}
                                <View style={styles.divider} />
                                <View style={styles.billingRow}>
                                    <Text style={styles.billLabel}>Subtotal</Text>
                                    <Text style={styles.billValue}>₹{getSubtotal()}</Text>
                                </View>

                                {/* Extra Charges List */}
                                {extraCharges.map((charge, idx) => (
                                    <View key={idx} style={styles.billingRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <TouchableOpacity onPress={() => {
                                                const newCharges = [...extraCharges];
                                                newCharges.splice(idx, 1);
                                                setExtraCharges(newCharges);
                                            }}>
                                                <Ionicons name="close-circle" size={14} color={colors.error} />
                                            </TouchableOpacity>
                                            <Text style={styles.billLabel}>{charge.name}</Text>
                                        </View>
                                        <Text style={styles.billValue}>₹{charge.amount}</Text>
                                    </View>
                                ))}

                                {discountType !== 'none' && (
                                    <View style={styles.billingRow}>
                                        <Text style={[styles.billLabel, { color: colors.error }]}>
                                            Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}
                                        </Text>
                                        <Text style={[styles.billValue, { color: colors.error }]}>-₹{getDiscountAmount()}</Text>
                                    </View>
                                )}

                                <View style={styles.billingRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.billLabel}>Taxes (GST)</Text>
                                    </View>
                                    <Text style={styles.billValue}>₹{getTaxAmount()}</Text>
                                </View>

                                <View style={[styles.billingRow, styles.billingTotalRow]}>
                                    <Text style={styles.billTotalLabel}>Total Amount</Text>
                                    <Text style={styles.billTotalValue}>₹{getTotal()}</Text>
                                </View>

                                <View style={styles.advancedActionsCenter}>
                                    <TouchableOpacity
                                        style={[styles.advancedBtn, { marginBottom: 10 }]}
                                        onPress={() => setShowExtraChargeModal(true)}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                                        <Text style={styles.advancedBtnText}>Extra Charge</Text>
                                    </TouchableOpacity>
                                </View>

                                {orderId && (
                                    <View style={styles.advancedActionsCenter}>
                                        <TouchableOpacity
                                            style={styles.advancedBtn}
                                            onPress={fetchActiveTablesForCombine}
                                        >
                                            <Ionicons name="git-merge-outline" size={18} color={colors.primary} />
                                            <Text style={styles.advancedBtnText}>Combine</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Kitchen Notes */}
                            <Text style={styles.sectionTitleMethod}>Kitchen Notes / Grievances</Text>
                            <TextInput
                                style={styles.notesInput}
                                placeholder="e.g. Less spicy, extra hot, no onions..."
                                placeholderTextColor={colors.textMuted}
                                value={orderNotes}
                                onChangeText={setOrderNotes}
                                multiline
                                numberOfLines={2}
                                textAlignVertical="top"
                            />

                            {/* Optional Payment Methods (only show if Settle Bill) */}
                            {showPayment && (
                                <>
                                    <Text style={styles.sectionTitleMethod}>Select Payment Method</Text>
                                    <View style={styles.paymentRow}>
                                        {PAYMENT_METHODS.map(m => {
                                            const isSelected = selectedPayment === m.id;
                                            return (
                                                <TouchableOpacity
                                                    key={m.id}
                                                    style={[styles.paymentCard, isSelected && styles.paymentCardActive]}
                                                    onPress={() => setSelectedPayment(m.id)}
                                                    activeOpacity={0.8}
                                                >
                                                    {isSelected && (
                                                        <LinearGradient colors={isDark ? ['rgba(198, 245, 61, 0.15)', 'transparent'] : ['rgba(198, 245, 61, 0.08)', 'transparent']} style={StyleSheet.absoluteFill} />
                                                    )}
                                                    <Ionicons name={m.icon as any} size={24} color={isSelected ? colors.primary : colors.textMuted} />
                                                    <Text style={[styles.paymentText, isSelected && styles.paymentTextActive]}>{m.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Action - Floating above the tab bar */}
                {items.length > 0 && (
                    <View style={styles.footerContainer}>
                        <LinearGradient colors={isDark ? ['transparent', 'rgba(5,5,10,0.8)', '#05050A'] : ['transparent', 'rgba(255,255,255,0.8)', '#FFFFFF']} style={styles.footerGradientBackground} />
                        <View style={styles.footer}>
                            {showPayment ? (
                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity style={styles.kotBtn} onPress={() => setShowPayment(false)}>
                                        <Text style={styles.kotText}>Cancel Pay</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.checkoutBtn} onPress={() => handleAction('pay')} disabled={isProcessing}>
                                        <LinearGradient colors={['#00D68F', '#00A86B']} style={styles.checkoutGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                            {isProcessing ? (
                                                <ActivityIndicator color={colors.white} />
                                            ) : (
                                                <>
                                                    <Text style={styles.checkoutText}>Pay & Close</Text>
                                                    <Text style={styles.checkoutPriceText}>₹{getTotal()}</Text>
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity style={styles.kotBtn} onPress={() => handleAction('kot')} disabled={isProcessing}>
                                        {isProcessing ? (
                                            <ActivityIndicator color={colors.white} />
                                        ) : (
                                            <View style={styles.checkoutActionGroup}>
                                                <Ionicons name="restaurant" size={20} color={colors.white} />
                                                <Text style={styles.kotText}>KOT</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.checkoutBtn}
                                        onPress={() => setShowPayment(true)}
                                        disabled={isProcessing}
                                    >
                                        <LinearGradient colors={gradients.primary} style={styles.checkoutGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                            <Ionicons name="cash-outline" size={22} color={colors.white} />
                                            <Text style={styles.checkoutText}>Settle Bill</Text>
                                            <Text style={styles.checkoutPriceText}>₹{getTotal()}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </SafeAreaView>


            {/* COMBINE ORDER MODAL */}
            <Modal visible={showCombineModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Combine Tables</Text>
                            <TouchableOpacity onPress={() => setShowCombineModal(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select a table to merge this order into.</Text>

                        {activeTables.length === 0 ? (
                            <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                                <Text style={{ color: colors.textMuted }}>No other active tables found.</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.splitList} showsVerticalScrollIndicator={false}>
                                {activeTables.map(table => {
                                    const isSelected = combineTargetTable === table.tableNumber;
                                    return (
                                        <TouchableOpacity
                                            key={table._id}
                                            style={[styles.splitItemRow, isSelected && styles.splitItemRowSelected]}
                                            onPress={() => setCombineTargetTable(table.tableNumber)}
                                        >
                                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.splitItemName}>{table.tableNumber}</Text>
                                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Order #{table.orderNumber} - ₹{table.total}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            style={[styles.modalActionBtn, !combineTargetTable && { opacity: 0.5 }]}
                            disabled={isProcessing || !combineTargetTable}
                            onPress={handleCombineOrder}
                        >
                            <LinearGradient colors={gradients.primary} style={styles.modalActionGradient}>
                                {isProcessing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalActionText}>Confirm Combine</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* EXTRA CHARGE MODAL */}
            <Modal visible={showExtraChargeModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Extra Charge</Text>
                            <TouchableOpacity onPress={() => setShowExtraChargeModal(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Charge Name (e.g. Service Charge)"
                            placeholderTextColor={colors.textMuted}
                            value={customChargeName}
                            onChangeText={setCustomChargeName}
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Amount (₹)"
                            placeholderTextColor={colors.textMuted}
                            value={customChargeAmount}
                            onChangeText={setCustomChargeAmount}
                            keyboardType="numeric"
                        />

                        <TouchableOpacity
                            style={[styles.modalActionBtn, (!customChargeName || !customChargeAmount) && { opacity: 0.5 }]}
                            disabled={!customChargeName || !customChargeAmount}
                            onPress={() => {
                                const amount = parseFloat(customChargeAmount);
                                if (isNaN(amount)) return;
                                setExtraCharges([...extraCharges, { name: customChargeName, amount }]);
                                setCustomChargeName('');
                                setCustomChargeAmount('');
                                setShowExtraChargeModal(false);
                            }}
                        >
                            <LinearGradient colors={gradients.primary} style={styles.modalActionGradient}>
                                <Text style={styles.modalActionText}>Add Charge</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </LinearGradient >
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    clearBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    clearText: { ...Typography.buttonSm, color: colors.error },
    content: { flex: 1, paddingHorizontal: Spacing.lg },
    scrollContent: { paddingBottom: 180 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 100 },
    emptyText: { ...Typography.h4, color: colors.textMuted },
    orderContainer: { flex: 1 },
    receiptCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, ...Shadows.sm
    },
    sectionTitle: { ...Typography.h5, color: colors.textPrimary, marginBottom: Spacing.md },
    cartItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 12 },
    itemInfo: { flex: 1 },
    itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    itemName: { ...Typography.body1, color: colors.textPrimary, flexShrink: 1 },
    readyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.success + '1A', 
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.success + '4D',
    },
    readyBadgeText: { ...Typography.caption, color: colors.success, fontWeight: '700', fontSize: 10 },
    itemPrice: { ...Typography.caption, color: colors.textMuted },
    itemAddedByText: { ...Typography.caption, color: colors.textSecondary, marginTop: 2, fontSize: 10, fontStyle: 'italic' },
    itemNotesInfo: { ...Typography.caption, color: colors.warning, marginTop: 4, fontStyle: 'italic' },
    qtyControls: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.sm,
        paddingHorizontal: 4, paddingVertical: 4, gap: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    qtyControlsStatic: {
        paddingHorizontal: 12, paddingVertical: 4,
        justifyContent: 'center', alignItems: 'center'
    },
    qtyTextStatic: { ...Typography.h5, color: colors.textSecondary },
    serveBtn: {
        backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.md, ...Shadows.sm
    },
    serveBtnText: { ...Typography.buttonSm, color: colors.white, fontWeight: '700' },
    qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    qtyText: { ...Typography.buttonSm, color: colors.white, minWidth: 18, textAlign: 'center' },
    itemTotal: { ...Typography.h5, color: colors.textPrimary, minWidth: 60, textAlign: 'right' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.md, borderStyle: 'dashed' },
    billingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    billLabel: { ...Typography.body2, color: colors.textSecondary },
    billValue: { ...Typography.body1, color: colors.textPrimary },
    billingTotalRow: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    billTotalLabel: { ...Typography.h4, color: colors.textPrimary },
    billTotalValue: { ...Typography.h3, color: colors.primary },
    sectionTitleMethod: { ...Typography.h5, color: colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.md },
    notesInput: {
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
        borderRadius: Radius.lg, padding: Spacing.md, color: colors.textPrimary,
        ...Typography.body2, minHeight: 80,
    },
    paymentRow: { flexDirection: 'row', gap: 10 },
    paymentCard: {
        flex: 1, backgroundColor: colors.card, borderRadius: Radius.lg, paddingVertical: Spacing.md,
        alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden'
    },
    paymentCardActive: { borderColor: colors.primary },
    paymentText: { ...Typography.buttonSm, color: colors.textMuted },
    paymentTextActive: { color: colors.primary },
    footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
    footerGradientBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, pointerEvents: 'none' },
    footer: { paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: 20 },
    actionButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    kotBtn: {
        flex: 1, backgroundColor: colors.glass, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: colors.border, paddingVertical: 18,
        justifyContent: 'center', alignItems: 'center', ...Shadows.sm
    },
    kotText: { ...Typography.buttonSm, color: colors.textPrimary, fontWeight: '700' },
    checkoutBtn: { flex: 1.5, borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.primary },
    checkoutGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between' },
    checkoutActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkoutText: { ...Typography.h5, color: colors.white, fontWeight: '700' },
    checkoutPriceText: { ...Typography.h5, color: colors.white, fontWeight: '800' },
    advancedActionsCenter: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
    advancedBtn: { width: '60%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.xl, backgroundColor: colors.primary + '1A', borderWidth: 1, borderColor: colors.primary + '33' },
    advancedBtnText: { ...Typography.button, color: colors.primary, fontWeight: '700' },
    serveAllBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#00D68F', paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: Radius.md, ...Shadows.sm
    },
    serveAllBtnText: { ...Typography.buttonSm, color: colors.white, fontWeight: '700', fontSize: 11 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
    modalTitle: { ...Typography.h3, color: colors.textPrimary },
    modalSubtitle: { ...Typography.body2, color: colors.textSecondary, marginBottom: Spacing.md },
    splitList: { maxHeight: 300, marginBottom: Spacing.sm },
    splitItemRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, backgroundColor: colors.glass, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
    splitItemRowSelected: { backgroundColor: colors.primary + '1A', borderColor: colors.primary },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.textMuted, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
    splitItemDetails: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    splitItemQty: { ...Typography.h5, color: colors.primary, width: 35 },
    splitItemName: { ...Typography.body1, color: colors.textPrimary, flex: 1 },
    modalInput: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md, color: colors.textPrimary, ...Typography.body1, marginBottom: Spacing.xl },
    modalActionBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
    modalActionGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    modalActionText: { ...Typography.h5, color: colors.white },
});
