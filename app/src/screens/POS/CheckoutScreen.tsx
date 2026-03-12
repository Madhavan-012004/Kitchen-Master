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
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import api from '../../api/client';
import { aiAPI } from '../../api/analytics';
import { useMenuStore } from '../../store/useMenuStore';
import { useSocket } from '../../hooks/useSocket';

const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: 'cash-outline' },
    { id: 'card', label: 'Card', icon: 'card-outline' },
    { id: 'upi', label: 'UPI / QR', icon: 'qr-code-outline' },
];

export default function CheckoutScreen({ route, navigation }: any) {
    const { items, getTotal, getTaxAmount, getSubtotal, removeItem, updateQuantity, clearCart, tableNumber, orderId, orderNotes, setOrderNotes, addItem } = useCartStore();
    const { items: allMenuItems } = useMenuStore();
    const [selectedPayment, setSelectedPayment] = useState<string>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPayment, setShowPayment] = useState(route.params?.showPayment || false);

    // Upsell State
    const [upsellSuggestions, setUpsellSuggestions] = useState<any[]>([]);
    const [loadingUpsell, setLoadingUpsell] = useState(false);

    useEffect(() => {
        if (items.length > 0 && !showPayment) {
            fetchUpsell();
        }
    }, [items.length, showPayment]);

    const fetchUpsell = async () => {
        setLoadingUpsell(true);
        try {
            const res = await aiAPI.getUpsellSuggestions(items);
            setUpsellSuggestions(res.data.data.suggestions || []);
        } catch (e) {
            console.error('Upsell fetch failed');
        } finally {
            setLoadingUpsell(false);
        }
    };

    const socket = useSocket();

    // Real-time item status updates
    useEffect(() => {
        if (!socket || !orderId) return;

        const handleItemUpdate = (data: any) => {
            if (data.orderId === orderId) {
                // Update item status in local store/state if necessary
                // The cart store doesn't have a status for items by default except when loaded
                // We should update the local items if they match
                useCartStore.getState().items.forEach(item => {
                    if (item._id === data.itemId) {
                        // This is a bit tricky since items in store might not have _id until saved
                        // But for existing orders, they do.
                    }
                });

                // Let's just refresh if there's an update to ensure consistency
                // Or better: update the specific item in the store
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

    const handleUpsellAdd = (suggestion: any) => {
        const fullItem = allMenuItems.find(m => m.name.toLowerCase() === suggestion.name.toLowerCase());
        if (fullItem) {
            addItem({
                menuItemId: fullItem._id,
                name: fullItem.name,
                price: fullItem.price,
                quantity: 1,
                taxRate: fullItem.taxRate,
                category: fullItem.category
            });
        } else {
            // Fallback for custom logic if item name doesn't match exactly
            Alert.alert('Info', 'Adding ' + suggestion.name);
        }
    };

    // Split & Combine State
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [selectedItemsForSplit, setSelectedItemsForSplit] = useState<string[]>([]);
    const [splitTableNumber, setSplitTableNumber] = useState('');

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

    const handleSplitOrder = async () => {
        if (!orderId || selectedItemsForSplit.length === 0 || !splitTableNumber.trim()) {
            return Alert.alert('Error', 'Please select items and provide a new table number.');
        }
        setIsProcessing(true);
        try {
            await api.post(`/orders/${orderId}/split`, {
                itemIds: selectedItemsForSplit,
                newTableNumber: splitTableNumber.trim()
            });
            Alert.alert('Success', 'Order split successfully', [
                { text: 'OK', onPress: () => { clearCart(); navigation.navigate('Tables'); } }
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to split order');
        } finally {
            setIsProcessing(false);
            setShowSplitModal(false);
        }
    };

    const handleCombineOrder = async () => {
        if (!orderId || !combineTargetTable) {
            return Alert.alert('Error', 'Please select a target table to combine with.');
        }

        const targetOrder = activeTables.find(t => t.tableNumber === combineTargetTable);
        if (!targetOrder) return Alert.alert('Error', 'Target order not found.');

        setIsProcessing(true);
        try {
            await api.post(`/orders/${orderId}/combine`, {
                targetOrderId: targetOrder._id
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

    const toggleSplitItem = (itemId: string) => {
        if (!itemId) return;
        if (selectedItemsForSplit.includes(itemId)) {
            setSelectedItemsForSplit(prev => prev.filter(id => id !== itemId));
        } else {
            setSelectedItemsForSplit(prev => [...prev, itemId]);
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
                discountType: 'none',
                discountValue: 0,
                discountAmount: 0,
                total: getTotal(),
                paymentMethod: actionType === 'pay' ? selectedPayment : 'pending',
                status: actionType === 'pay' ? 'paid' : 'preparing',
                notes: orderNotes,
            };

            if (orderId) {
                await api.put(`/orders/${orderId}`, orderPayload);
                if (actionType === 'pay') {
                    // Update the status to complete/paid AND request a bill print
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
            await api.patch(`/orders/${orderId}/items/${item._id}/status`, { status: 'served' });
            useCartStore.getState().markItemServed(item.menuItemId);
        } catch (error) {
            console.error('Failed to mark item as served:', error);
            Alert.alert('Error', 'Could not update item status.');
        }
    };

    const renderCartItem = ({ item }: any) => {
        const isReady = item.status === 'ready' || item.status === 'served';

        return (
            <View style={styles.cartItemRow}>
                <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        {isReady && (
                            <View style={styles.readyBadge}>
                                <Ionicons name="checkmark-done" size={12} color={Colors.success} />
                                <Text style={styles.readyBadgeText}>
                                    {item.status === 'served' ? 'Served' : 'Ready'}
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
                            style={styles.qtyBtn}
                            onPress={() => {
                                if (item.quantity === 1) removeItem(item.menuItemId);
                                else updateQuantity(item.menuItemId, item.quantity - 1);
                            }}
                        >
                            <Ionicons name="remove" size={16} color={Colors.white} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                        >
                            <Ionicons name="add" size={16} color={Colors.white} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.qtyControlsStatic}>
                        {item.status === 'ready' ? (
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
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.white} />
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
                            <Ionicons name="cart-outline" size={60} color={Colors.textMuted} />
                            <Text style={styles.emptyText}>Order is empty</Text>
                        </View>
                    ) : (
                        <View style={styles.orderContainer}>
                            <View style={styles.receiptCard}>
                                <Text style={styles.sectionTitle}>Order Items</Text>
                                {/* In a ScrollView, FlatList is better not inside another ScrollView without bounded height, but since we have a small num of items it is okay, or we map it */}
                                {items.map((item, idx) => <React.Fragment key={item._id || `cart-${idx}`}>{renderCartItem({ item })}</React.Fragment>)}
                                <View style={styles.divider} />
                                <View style={styles.billingRow}>
                                    <Text style={styles.billLabel}>Subtotal</Text>
                                    {showPayment && <Text style={styles.billValue}>₹{getSubtotal()}</Text>}
                                </View>
                                <View style={styles.billingRow}>
                                    <Text style={styles.billLabel}>Taxes (GST)</Text>
                                    {showPayment && <Text style={styles.billValue}>₹{getTaxAmount()}</Text>}
                                </View>
                                <View style={[styles.billingRow, styles.billingTotalRow]}>
                                    <Text style={styles.billTotalLabel}>Total Amount</Text>
                                    {showPayment && <Text style={styles.billTotalValue}>₹{getTotal()}</Text>}
                                </View>

                                {/* Advanced Table Management Actions */}
                                {orderId && (
                                    <View style={styles.advancedActionsRow}>
                                        <TouchableOpacity
                                            style={styles.advancedBtn}
                                            onPress={() => {
                                                setSelectedItemsForSplit([]);
                                                setSplitTableNumber('');
                                                setShowSplitModal(true);
                                            }}
                                        >
                                            <Ionicons name="git-merge-outline" size={18} color={Colors.primary} style={{ transform: [{ rotate: '180deg' }] }} />
                                            <Text style={styles.advancedBtnText}>Split Bill</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.advancedBtn}
                                            onPress={fetchActiveTablesForCombine}
                                        >
                                            <Ionicons name="git-merge-outline" size={18} color={Colors.primary} />
                                            <Text style={styles.advancedBtnText}>Combine</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* AI Recommendations (Upsell) */}
                            {!showPayment && (upsellSuggestions.length > 0 || loadingUpsell) && (
                                <View style={styles.upsellSection}>
                                    <View style={styles.upsellHeader}>
                                        <Ionicons name="sparkles" size={16} color={Colors.accentYellow} />
                                        <Text style={styles.upsellTitle}>AI Recommendations</Text>
                                    </View>
                                    {loadingUpsell ? (
                                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                                    ) : (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upsellScroll}>
                                            {upsellSuggestions.map((s, idx) => (
                                                <TouchableOpacity key={idx} style={styles.upsellCard} onPress={() => handleUpsellAdd(s)}>
                                                    <LinearGradient colors={['rgba(255,107,53,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
                                                    <View style={styles.upsellCardContent}>
                                                        <Text style={styles.upsellItemName} numberOfLines={1}>{s.name}</Text>
                                                        <Text style={styles.upsellReason} numberOfLines={2}>{s.reason}</Text>
                                                        <View style={styles.upsellAddBtn}>
                                                            <Ionicons name="add" size={14} color={Colors.white} />
                                                            <Text style={styles.upsellAddText}>Add</Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            )}

                            {/* Kitchen Notes */}
                            <Text style={styles.sectionTitleMethod}>Kitchen Notes / Grievances</Text>
                            <TextInput
                                style={styles.notesInput}
                                placeholder="e.g. Less spicy, extra hot, no onions..."
                                placeholderTextColor={Colors.textMuted}
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
                                                        <LinearGradient colors={['rgba(255,107,53,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />
                                                    )}
                                                    <Ionicons name={m.icon as any} size={24} color={isSelected ? Colors.primary : Colors.textMuted} />
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
                        <LinearGradient colors={['transparent', 'rgba(5,5,10,0.8)', '#05050A']} style={styles.footerGradientBackground} />
                        <View style={styles.footer}>
                            {showPayment ? (
                                // Payment Actions
                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity style={styles.kotBtn} onPress={() => setShowPayment(false)}>
                                        <Text style={styles.kotText}>Cancel Pay</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.checkoutBtn} onPress={() => handleAction('pay')} disabled={isProcessing}>
                                        <LinearGradient colors={['#00D68F', '#00A86B']} style={styles.checkoutGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                            {isProcessing ? (
                                                <ActivityIndicator color={Colors.white} />
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
                                // Primary Actions: KOT + Settle Bill
                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity style={styles.kotBtn} onPress={() => handleAction('kot')} disabled={isProcessing}>
                                        {isProcessing ? (
                                            <ActivityIndicator color={Colors.white} />
                                        ) : (
                                            <View style={styles.checkoutActionGroup}>
                                                <Ionicons name="restaurant" size={20} color={Colors.white} />
                                                <Text style={styles.kotText}>KOT</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.checkoutBtn}
                                        onPress={() => setShowPayment(true)}
                                        disabled={isProcessing}
                                    >
                                        <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.checkoutGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                            <Ionicons name="cash-outline" size={22} color={Colors.white} />
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

            {/* SPLIT ORDER MODAL */}
            <Modal visible={showSplitModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Split Order</Text>
                            <TouchableOpacity onPress={() => setShowSplitModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select items to move to a new table.</Text>

                        <ScrollView style={styles.splitList} showsVerticalScrollIndicator={false}>
                            {items.map((item, idx) => {
                                const isSelected = item._id ? selectedItemsForSplit.includes(item._id) : false;
                                return (
                                    <TouchableOpacity
                                        key={item._id || `split-${idx}`}
                                        style={[styles.splitItemRow, isSelected && styles.splitItemRowSelected]}
                                        onPress={() => item._id && toggleSplitItem(item._id)}
                                    >
                                        <View style={styles.splitItemDetails}>
                                            <Text style={styles.splitItemQty}>{item.quantity}x</Text>
                                            <Text style={styles.splitItemName}>{item.name}</Text>
                                        </View>
                                        <Ionicons
                                            name={isSelected ? "checkbox" : "square-outline"}
                                            size={24}
                                            color={isSelected ? Colors.primary : Colors.textMuted}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <Text style={[styles.sectionTitleMethod, { marginTop: Spacing.md }]}>Target Table Number</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Table 5"
                            placeholderTextColor={Colors.textMuted}
                            value={splitTableNumber}
                            onChangeText={setSplitTableNumber}
                        />

                        <TouchableOpacity
                            style={[styles.modalActionBtn, (selectedItemsForSplit.length === 0 || !splitTableNumber) && { opacity: 0.5 }]}
                            disabled={isProcessing || selectedItemsForSplit.length === 0 || !splitTableNumber}
                            onPress={handleSplitOrder}
                        >
                            <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.modalActionGradient}>
                                {isProcessing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Confirm Split</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* COMBINE ORDER MODAL */}
            <Modal visible={showCombineModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Combine Tables</Text>
                            <TouchableOpacity onPress={() => setShowCombineModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>Select a table to merge this order into.</Text>

                        {activeTables.length === 0 ? (
                            <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                                <Text style={{ color: Colors.textMuted }}>No other active tables found.</Text>
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
                                                {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.splitItemName}>{table.tableNumber}</Text>
                                                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Order #{table.orderNumber} - ₹{table.total}</Text>
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
                            <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.modalActionGradient}>
                                {isProcessing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalActionText}>Confirm Combine</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </LinearGradient >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    clearBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    clearText: { ...Typography.buttonSm, color: Colors.error },
    content: { flex: 1, paddingHorizontal: Spacing.lg },
    scrollContent: { paddingBottom: 180 }, // give it mega space at bottom
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 100 },
    emptyText: { ...Typography.h4, color: Colors.textMuted },
    orderContainer: { flex: 1 },
    receiptCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.glassBorder, ...Shadows.sm
    },
    sectionTitle: { ...Typography.h5, color: Colors.textPrimary, marginBottom: Spacing.md },
    cartList: { flexGrow: 0 },
    cartItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 12 },
    itemInfo: { flex: 1 },
    itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    itemName: { ...Typography.body1, color: Colors.textPrimary, flexShrink: 1 },
    readyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,214,143,0.1)',
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(0,214,143,0.3)',
    },
    readyBadgeText: { ...Typography.caption, color: Colors.success, fontWeight: '700', fontSize: 10 },
    itemPrice: { ...Typography.caption, color: Colors.textMuted },
    itemAddedByText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, fontSize: 10, fontStyle: 'italic' },
    itemNotesInfo: { ...Typography.caption, color: Colors.warning, marginTop: 4, fontStyle: 'italic' },
    qtyControls: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.sm,
        paddingHorizontal: 4, paddingVertical: 4, gap: 10,
        borderWidth: 1, borderColor: Colors.border,
    },
    qtyControlsStatic: {
        paddingHorizontal: 12, paddingVertical: 4,
        justifyContent: 'center', alignItems: 'center'
    },
    qtyTextStatic: { ...Typography.h5, color: Colors.textSecondary },
    serveBtn: {
        backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.md, ...Shadows.sm
    },
    serveBtnText: { ...Typography.buttonSm, color: Colors.white, fontWeight: '700' },
    qtyBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    qtyText: { ...Typography.buttonSm, color: Colors.white, minWidth: 18, textAlign: 'center' },
    itemTotal: { ...Typography.h5, color: Colors.white, minWidth: 60, textAlign: 'right' },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md, borderStyle: 'dashed' },
    billingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    billLabel: { ...Typography.body2, color: Colors.textSecondary },
    billValue: { ...Typography.body1, color: Colors.white },
    billingTotalRow: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
    billTotalLabel: { ...Typography.h4, color: Colors.white },
    billTotalValue: { ...Typography.h3, color: Colors.primary },
    sectionTitleMethod: { ...Typography.h5, color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.md },
    notesInput: {
        backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
        borderRadius: Radius.lg, padding: Spacing.md, color: Colors.white,
        ...Typography.body2, minHeight: 80,
    },
    paymentRow: { flexDirection: 'row', gap: 10 },
    paymentCard: {
        flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, paddingVertical: Spacing.md,
        alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden'
    },
    paymentCardActive: { borderColor: Colors.primary },
    paymentText: { ...Typography.buttonSm, color: Colors.textMuted },
    paymentTextActive: { color: Colors.primary },
    settleBillBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginTop: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: Colors.glass
    },
    settleBillText: { ...Typography.buttonSm, color: Colors.textMuted },
    footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
    footerGradientBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, pointerEvents: 'none' },
    footer: { paddingHorizontal: Spacing.lg, paddingBottom: 110, paddingTop: 20 },
    actionButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    kotBtn: {
        flex: 1, backgroundColor: Colors.glass, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.border, paddingVertical: 20,
        justifyContent: 'center', alignItems: 'center', ...Shadows.sm
    },
    kotText: { ...Typography.buttonSm, color: Colors.white, fontWeight: '700' },
    checkoutBtn: { flex: 1.5, borderRadius: Radius.xl, overflow: 'hidden', shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
    checkoutGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, justifyContent: 'space-between' },
    checkoutActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkoutText: { ...Typography.h5, color: Colors.white, fontWeight: '700' },
    checkoutPriceTag: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round },
    checkoutPriceText: { ...Typography.h5, color: Colors.white, fontWeight: '800' },
    advancedActionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    advancedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: 'rgba(255,107,53,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
    advancedBtnText: { ...Typography.buttonSm, color: Colors.primary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
    modalTitle: { ...Typography.h3, color: Colors.textPrimary },
    modalSubtitle: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
    splitList: { maxHeight: 300, marginBottom: Spacing.sm },
    splitItemRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
    splitItemRowSelected: { backgroundColor: 'rgba(255,107,53,0.1)', borderColor: Colors.primary },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.textMuted, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    splitItemDetails: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    splitItemQty: { ...Typography.h5, color: Colors.primary, width: 35 },
    splitItemName: { ...Typography.body1, color: Colors.textPrimary, flex: 1 },
    splitItemPrice: { ...Typography.body1, color: Colors.white, fontWeight: '700' },
    modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, color: Colors.white, ...Typography.body1, marginBottom: Spacing.xl },
    modalActionBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
    modalActionGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    modalActionText: { ...Typography.h5, color: Colors.white },

    // Upsell Styles
    upsellSection: { marginTop: Spacing.xl },
    upsellHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
    upsellTitle: { ...Typography.overline, color: Colors.accentYellow, letterSpacing: 1 },
    upsellScroll: { gap: 12, paddingRight: 20 },
    upsellCard: {
        width: 160, backgroundColor: Colors.card, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    },
    upsellCardContent: { padding: 12, gap: 4 },
    upsellItemName: { ...Typography.buttonSm, color: Colors.textPrimary },
    upsellReason: { ...Typography.caption, color: Colors.textMuted, fontSize: 10, lineHeight: 14, height: 28 },
    upsellAddBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 4, marginTop: 4
    },
    upsellAddText: { ...Typography.caption, color: Colors.white, fontWeight: '700' },
});
