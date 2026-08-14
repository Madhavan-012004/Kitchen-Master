import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    FlatList, Alert, ActivityIndicator, ScrollView, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import { useAppTheme } from '../../theme';

type Client = { _id?: any; id?: any; name: string; email?: string; phone?: string; defaultDiscount: number; categoryDiscounts?: any[] };
type MenuItem = { _id?: any; id?: any; name: string; price: number; sellingPrice?: number; buyingPrice?: number; quantityType?: string; category?: string; };
type CartItem = { id: any; name: string; qty: number; type: string; rate: number; buyingPrice: number; amount: number; category?: string; };

export default function PoultryPOSScreen() {
    const navigation = useNavigation<any>();
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();

    const defaultRetailClient = { _id: 'walkin', id: 'walkin', name: 'Retail', defaultDiscount: 0, categoryDiscounts: [] };
    const [clients, setClients] = useState<Client[]>([defaultRetailClient]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(defaultRetailClient);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [weight, setWeight] = useState('');
    const [qty, setQty] = useState('1');
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
    const [saving, setSaving] = useState(false);
    const [showClientPicker, setShowClientPicker] = useState(false);
    const [clientSearch, setClientSearch] = useState('');

    useEffect(() => {
        const loadData = () => {
            apiClient.get('/menu').then(r => {
                const items = r.data?.data?.items || r.data?.data?.menuItems || [];
                setMenuItems(items);
            }).catch(console.error);
            apiClient.get('/inventory').then(r => {
                const data = r.data?.data || r.data || [];
                setInventoryItems(Array.isArray(data) ? data : []);
            }).catch(console.error);
            const fetchClients = async () => {
                try {
                    const local = await AsyncStorage.getItem('poultry_clients');
                    if (local) {
                        const localClients = JSON.parse(local).filter((c: any) => c.isActive !== false);
                        setClients([defaultRetailClient, ...localClients]);
                    } else {
                        setClients([defaultRetailClient]);
                    }
                } catch (e) {
                    console.warn('Failed resolving local poultry cache', e);
                    setClients([defaultRetailClient]);
                }
            };
            fetchClients();
        };
        loadData();
        const intervalId = setInterval(loadData, 5000);
        return () => clearInterval(intervalId);
    }, []);

    const handleClientSelect = (client: Client) => {
        setSelectedClient(client);
        setDiscount(client.defaultDiscount ?? 0);
        setShowClientPicker(false);
    };

    const addToCart = () => {
        if (!selectedItem) { Alert.alert('Select an item first.'); return; }
        const w = parseFloat(weight) || 0;
        const q = parseInt(qty) || 1;
        const quantity = w > 0 ? w : q;
        const type = w > 0 ? 'kg' : (selectedItem.quantityType || 'pcs');
        let rate = selectedItem.sellingPrice && selectedItem.sellingPrice > 0 ? selectedItem.sellingPrice : selectedItem.price;

        if (selectedClient && selectedClient.categoryDiscounts && selectedClient.categoryDiscounts.length > 0) {
            const catLower = (selectedItem.category || '').toLowerCase();
            const discount = selectedClient.categoryDiscounts.find(d => (d.category || '').toLowerCase() === catLower);
            if (discount && (discount.discount > 0 || discount.value > 0)) {
                const amount = discount.discount || discount.value;
                if (discount.type === 'percentage') {
                    rate = rate - (rate * amount / 100);
                } else if (discount.type === 'amount') {
                    rate = rate - amount;
                }
            }
        }

        rate = +rate.toFixed(2);
        const amount = +(quantity * rate).toFixed(2);
        const id = selectedItem._id || selectedItem.id;

        setCart(prev => {
            const existing = prev.find(i => i.id === id);
            if (existing) return prev.map(i => i.id === id ? { ...i, qty: +(i.qty + quantity).toFixed(3), amount: +((i.qty + quantity) * rate).toFixed(2) } : i);
            return [...prev, { id, name: selectedItem.name, qty: quantity, type, rate, buyingPrice: selectedItem.buyingPrice || 0, amount, category: selectedItem.category }];
        });
        setSelectedItem(null); setWeight(''); setQty('1');
    };

    const subtotal = cart.reduce((a, i) => a + i.amount, 0);
    const discountAmt = +(subtotal * discount / 100).toFixed(2);
    const total = +(subtotal - discountAmt).toFixed(2);

    const handleGenerateBill = async () => {
        if (cart.length === 0) { Alert.alert('Add items to the bill.'); return; }
        setSaving(true);
        const clientId = selectedClient && String(selectedClient._id || selectedClient.id) !== 'walkin'
            ? (selectedClient._id || selectedClient.id) : null;
        const paymentStatus = paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID';
        const savedBillNumber = `PLT-${Date.now().toString().slice(-5)}`;
        const customNotes = `||BILLNO:${savedBillNumber}||`;

        try {
            const genericPayload = {
                tableNumber: null,
                source: 'poultry',
                orderType: 'takeaway',
                billNumber: savedBillNumber,
                orderNumber: savedBillNumber,
                status: 'PAID', // Fix: Use 'PAID' instead of invalid 'COMPLETED' Enum
                paymentStatus: paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID',
                paymentMethod,
                customerName: selectedClient ? selectedClient.name : 'Walk-in',
                customerPhone: selectedClient ? selectedClient.phone : undefined,
                subtotal, total, discountAmount: discountAmt,
                notes: customNotes,
                items: cart.map(i => {
                    const matchedCat = (i.category || '').trim().toLowerCase();
                    const invList = Array.isArray(inventoryItems) ? inventoryItems : [];
                    const invItem = invList.find(inv =>
                        (inv.category || '').trim().toLowerCase() === matchedCat ||
                        (inv.name || '').trim().toLowerCase() === matchedCat
                    );
                    return {
                        menuItemId: i.id,
                        name: i.name,
                        price: i.rate,
                        quantity: i.qty,
                        notes: `Weight: ${i.qty}${i.type} @ ${i.rate}`,
                        category: i.category,
                        inventoryItemId: invItem ? invItem._id || invItem.id : undefined,
                        taxRate: 0
                    };
                })
            };

            const response = await apiClient.post('/orders', genericPayload);
            const savedOrder = response.data?.data?.order || response.data?.data || response.data;
            const validId = savedOrder?.id || savedOrder?._id;

            if (paymentStatus !== 'PENDING' && validId) {
                try {
                    await apiClient.patch(`/orders/${validId}/payment`, {
                        paymentMethod,
                        paymentStatus
                    });
                } catch (ignor) { }
            }

            Alert.alert('✅ Bill Generated', `Total: ₹${total.toFixed(2)}`, [{ text: 'OK', onPress: () => { setCart([]); setDiscount(selectedClient?.defaultDiscount || 0); } }]);
        } catch (e) {
            console.warn('Bill save error:', e);
            Alert.alert('Bill Generated (offline)', `Total: ₹${total.toFixed(2)}`);
            setCart([]);
        } finally {
            // ALWAYS save to offline cache (both success & failure) identical to Web so Ledger displays it immediately
            try {
                const constructedOfflineBill = {
                    id: savedBillNumber,
                    _id: savedBillNumber,
                    billNumber: savedBillNumber,
                    orderNumber: savedBillNumber,
                    client: clientId ? { id: clientId, _id: clientId, name: selectedClient?.name } : null,
                    clientName: selectedClient ? selectedClient.name : 'Walk-in',
                    totalAmount: total,
                    grandTotal: total,
                    discountAmount: discountAmt,
                    subtotal,
                    paymentMethod,
                    paymentStatus,
                    items: cart.map(i => ({
                        itemName: i.name,
                        menuItemId: i.id,
                        quantity: i.qty,
                        quantityType: i.type,
                        rate: i.rate,
                        buyingPrice: i.buyingPrice,
                        amount: i.amount
                    })),
                    date: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    source: 'poultry',
                    notes: customNotes
                };

                const rawLocal = await AsyncStorage.getItem('poultry_history_bills');
                const localBills = rawLocal ? JSON.parse(rawLocal) : [];
                localBills.push(constructedOfflineBill);
                if (localBills.length > 50) localBills.shift();
                await AsyncStorage.setItem('poultry_history_bills', JSON.stringify(localBills));

                if (clientId && paymentMethod === 'CREDIT') {
                    try {
                        const rawClients = await AsyncStorage.getItem('poultry_clients');
                        if (rawClients) {
                            const localClients = JSON.parse(rawClients);
                            const idx = localClients.findIndex((c: any) => c.id === clientId || c._id === clientId);
                            if (idx >= 0) {
                                localClients[idx].pendingAmount = (localClients[idx].pendingAmount || 0) + total;
                                await AsyncStorage.setItem('poultry_clients', JSON.stringify(localClients));
                            }
                        }
                    } catch (ignor) { }
                }
            } catch (ce) {
                console.warn('Failed to save poultry bill to local cache', ce);
            }

            setSaving(false);
        }
    };

    const s = styles(colors, isDark);

    return (
        <SafeAreaView style={s.container}>
            {/* Header */}
            <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            try {
                                if (navigation.getParent()) {
                                    navigation.getParent().navigate('Poultry Clients');
                                } else {
                                    navigation.navigate('Poultry Clients');
                                }
                            } catch (e) {
                                console.warn('Fallback nav failed', e);
                            }
                        }
                    }}
                    style={{ padding: 8, marginLeft: -4 }}
                >
                    <Ionicons name="close" size={26} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Poultry POS</Text>
                <TouchableOpacity style={s.clientBtn} onPress={() => setShowClientPicker(true)}>
                    <Ionicons name="person" size={16} color={isDark ? '#000' : '#fff'} />
                    <Text style={s.clientBtnText} numberOfLines={1}>
                        {selectedClient ? selectedClient.name : 'Retail'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={isDark ? '#000' : '#fff'} />
                </TouchableOpacity>
            </View>

            {selectedClient && selectedClient.defaultDiscount > 0 && (
                <View style={s.discountBanner}>
                    <Text style={s.discountBannerText}>🏷️ {selectedClient.name} — {selectedClient.defaultDiscount}% discount auto-applied</Text>
                </View>
            )
            }

            {/* Products */}
            <View style={s.productsSection}>
                <Text style={s.sectionLabel}>ITEMS</Text>
                <FlatList
                    data={menuItems}
                    horizontal
                    keyExtractor={(item, i) => String(item._id || item.id || i)}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[s.productChip, selectedItem?._id === item._id && s.productChipSelected]}
                            onPress={() => setSelectedItem(item)}
                        >
                            <Text style={s.productChipName}>{item.name}</Text>
                            {(item.sellingPrice || item.price) ? (
                                <Text style={s.productChipRate}>₹{item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : item.price} / {item.quantityType || 'kg'}</Text>
                            ) : null}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ color: colors.textMuted, padding: 12 }}>No items. Add from Menu.</Text>}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8 }}
                />
            </View>

            {/* Input Row */}
            {
                selectedItem && (
                    <View style={s.inputRow}>
                        <View style={s.inputGroup}>
                            <Text style={s.inputLabel}>Rate</Text>
                            <Text style={s.inputStatic}>
                                ₹{(() => {
                                    let r = selectedItem.sellingPrice || selectedItem.price;
                                    if (selectedClient?.categoryDiscounts) {
                                        const d = selectedClient.categoryDiscounts.find(d => (d.category || '').toLowerCase() === (selectedItem.category || '').toLowerCase());
                                        if (d && (d.discount > 0 || d.value > 0)) {
                                            const amount = d.discount || d.value || 0;
                                            r = d.type === 'percentage' ? r - (r * amount / 100) : r - amount;
                                        }
                                    }
                                    return r.toFixed(2);
                                })()}
                            </Text>
                        </View>
                        <View style={s.inputGroup}>
                            <Text style={s.inputLabel}>Weight (kg)</Text>
                            <View style={s.inputBox}>
                                <TextInput
                                    style={s.inputText}
                                    value={weight}
                                    onChangeText={setWeight}
                                    keyboardType="numeric"
                                    placeholder="0.000"
                                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                />
                            </View>
                        </View>
                        <View style={s.inputGroup}>
                            <Text style={s.inputLabel}>Qty (pcs)</Text>
                            <View style={s.inputBox}>
                                <TextInput
                                    style={s.inputText}
                                    value={qty}
                                    onChangeText={setQty}
                                    keyboardType="numeric"
                                    placeholder="1"
                                    placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                                />
                            </View>
                        </View>
                        <View style={s.inputGroup}>
                            <Text style={s.inputLabel}>Amount</Text>
                            <Text style={[s.inputStatic, { color: colors.accent }]}>
                                ₹{(() => {
                                    let r = selectedItem.sellingPrice || selectedItem.price;
                                    if (selectedClient?.categoryDiscounts) {
                                        const d = selectedClient.categoryDiscounts.find(d => (d.category || '').toLowerCase() === (selectedItem.category || '').toLowerCase());
                                        if (d && (d.discount > 0 || d.value > 0)) {
                                            const amount = d.discount || d.value || 0;
                                            r = d.type === 'percentage' ? r - (r * amount / 100) : r - amount;
                                        }
                                    }
                                    const quantity = parseFloat(weight) > 0 ? parseFloat(weight) : parseInt(qty) || 1;
                                    return (quantity * r).toFixed(2);
                                })()}
                            </Text>
                        </View>
                        <TouchableOpacity style={s.addBtn} onPress={addToCart}>
                            <Text style={s.addBtnText}>ADD</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Cart */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
                {cart.map(item => (
                    <View key={item.id} style={s.cartRow}>
                        <Text style={[s.cartCell, { flex: 2 }]}>{item.name}</Text>
                        <Text style={s.cartCell}>{item.qty} {item.type}</Text>
                        <Text style={s.cartCell}>₹{item.rate}</Text>
                        <Text style={[s.cartCell, { color: colors.accent, fontWeight: '700' }]}>₹{item.amount.toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => setCart(c => c.filter(i => i.id !== item.id))}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                ))}
                {cart.length === 0 && <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>Select an item and tap ADD</Text>}
            </ScrollView>

            {/* Bill Footer */}
            {
                cart.length > 0 && (
                    <View style={s.footer}>
                        <View style={s.footerRow}><Text style={s.footerLabel}>Subtotal</Text><Text style={s.footerVal}>₹{subtotal.toFixed(2)}</Text></View>
                        {discountAmt > 0 && <View style={s.footerRow}><Text style={s.footerLabel}>Discount ({discount}%)</Text><Text style={{ color: '#10b981', fontWeight: '600' }}>−₹{discountAmt.toFixed(2)}</Text></View>}
                        <View style={[s.footerRow, { marginTop: 4 }]}><Text style={[s.footerLabel, { fontSize: 17, color: colors.textPrimary }]}>Total</Text><Text style={{ fontSize: 20, fontWeight: '700', color: colors.accent }}>₹{total.toFixed(2)}</Text></View>
                        <View style={s.payMethods}>
                            {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map(m => (
                                <TouchableOpacity key={m} style={[s.payMethod, paymentMethod === m && s.payMethodActive]} onPress={() => setPaymentMethod(m)}>
                                    <Text style={[s.payMethodText, paymentMethod === m && { color: '#0f172a' }]}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={[s.generateBtn, saving && { opacity: 0.6 }]} onPress={handleGenerateBill} disabled={saving}>
                            {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={s.generateBtnText}>✓ GENERATE BILL</Text>}
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Client Picker Modal */}
            {
                showClientPicker && (
                    <View style={s.pickerOverlay}>
                        <View style={s.pickerSheet}>
                            <Text style={s.pickerTitle}>Select Client</Text>
                            <TextInput
                                style={s.pickerSearchInput}
                                placeholder="Search clients by name or phone..."
                                placeholderTextColor={colors.textMuted}
                                value={clientSearch}
                                onChangeText={setClientSearch}
                                autoCapitalize="none"
                            />
                            <FlatList
                                data={clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch))}
                                keyExtractor={(item, i) => String(item._id || item.id || i)}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={s.pickerItem} onPress={() => { setClientSearch(''); handleClientSelect(item); }}>
                                        <Text style={s.pickerItemName}>{item.name}</Text>
                                        {item.defaultDiscount > 0 && <Text style={s.pickerItemBadge}>{item.defaultDiscount}% off</Text>}
                                    </TouchableOpacity>
                                )}
                            />
                            <TouchableOpacity onPress={() => { setClientSearch(''); setShowClientPicker(false); }} style={s.pickerClose}>
                                <Text style={{ color: colors.textMuted }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )
            }
        </SafeAreaView >
    );
}

const styles = (colors: any, isDark: boolean) => {
    const forcedWhite = isDark ? '#FFFFFF' : (colors.textPrimary || '#000000');
    const mutedWhite = isDark ? '#e2e8f0' : (colors.textMuted || '#64748b');
    const contrastBlackOnLight = isDark ? '#FFFFFF' : '#0f172a';

    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
        headerTitle: { fontSize: 18, fontWeight: '700', color: forcedWhite, flex: 1 },
        clientBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, maxWidth: 170 },
        clientBtnText: { color: forcedWhite, fontSize: 13, fontWeight: '700' },
        discountBanner: { marginHorizontal: 14, marginBottom: 8, padding: 10, backgroundColor: 'rgba(198,245,61,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(198,245,61,0.2)' },
        discountBannerText: { color: forcedWhite, fontSize: 12, fontWeight: '600' },
        sectionLabel: { fontSize: 11, fontWeight: '700', color: mutedWhite, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 14, marginBottom: 0 },
        productsSection: { borderBottomWidth: 1, borderBottomColor: colors.border },
        productChip: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginRight: 10, borderWidth: 1, borderColor: colors.border, minWidth: 100, alignItems: 'center' },
        productChipSelected: { borderColor: colors.primary, backgroundColor: 'rgba(198,245,61,0.08)' },
        productChipName: { color: forcedWhite, fontWeight: '700', fontSize: 13 },
        productChipRate: { color: mutedWhite, fontSize: 11, marginTop: 2 },
        inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
        inputGroup: { alignItems: 'center' },
        inputLabel: { fontSize: 11, color: mutedWhite, marginBottom: 4 },
        inputStatic: { fontSize: 18, fontWeight: '700', color: forcedWhite },
        inputBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, minWidth: 70, alignItems: 'center' },
        inputText: { fontSize: 16, color: forcedWhite, fontWeight: '600' },
        addBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
        addBtnText: { color: contrastBlackOnLight, fontWeight: '700', fontSize: 15 },
        cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
        cartCell: { flex: 1, color: forcedWhite, fontSize: 13 },
        footer: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
        footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
        footerLabel: { color: mutedWhite, fontSize: 14 },
        footerVal: { color: forcedWhite, fontSize: 16, fontWeight: '700' },
        payMethods: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
        payMethod: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        payMethodActive: { backgroundColor: colors.accent, borderColor: colors.accent },
        payMethodText: { color: forcedWhite, fontSize: 12, fontWeight: '600' },
        generateBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
        generateBtnText: { color: forcedWhite, fontWeight: '700', fontSize: 15 },
        pickerOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        pickerSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
        pickerTitle: { fontSize: 17, fontWeight: '700', color: forcedWhite, marginBottom: 14 },
        pickerSearchInput: { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 10, padding: 12, fontSize: 15, color: forcedWhite, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
        pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
        pickerItemName: { color: forcedWhite, fontSize: 15 },
        pickerItemBadge: { color: colors.primary, fontSize: 12, fontWeight: '600' },
        pickerClose: { marginTop: 16, alignItems: 'center', padding: 12 },
    });
};
