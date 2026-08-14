import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    SafeAreaView, ActivityIndicator, TextInput, Modal,
    KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import { useAppTheme } from '../../theme';

type PoultryClient = {
    _id?: string | number;
    id?: string | number;
    name: string;
    phone?: string;
    address?: string;
    defaultDiscount: number;
    pendingAmount: number;
    totalPurchase: number;
    lastPurchase?: string;
    categoryDiscounts?: { category: string; type: 'amount' | 'percentage'; discount: number }[];
};

export default function PoultryClientsScreen() {
    const navigation = useNavigation<any>();
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();

    const [clients, setClients] = useState<PoultryClient[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<PoultryClient | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', phone: '', address: '', defaultDiscount: '0', pendingAmount: '0',
        categoryDiscounts: [] as { category: string; type: 'amount' | 'percentage'; discount: string }[]
    });

    const PENDING_KEY = 'poultry_clients_pending';

    const syncPendingClients = async () => {
        try {
            const raw = await AsyncStorage.getItem(PENDING_KEY);
            if (!raw) return;
            const pending: PoultryClient[] = JSON.parse(raw);
            if (pending.length === 0) return;
            const synced: string[] = [];
            for (const c of pending) {
                try {
                    const meta = { isPoultry: true, address: c.address || '', defaultDiscount: c.defaultDiscount ?? 0, pendingAmount: c.pendingAmount ?? 0, categoryDiscounts: c.categoryDiscounts || [] };
                    await apiClient.post('/customers', {
                        name: c.name, phone: c.phone || '',
                        email: '||META:' + JSON.stringify(meta)
                    });
                    synced.push(String(c._id || c.id || ''));
                } catch { /* still offline */ }
            }
            if (synced.length > 0) {
                const remaining = pending.filter(c => !synced.includes(String(c._id || c.id || '')));
                await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
            }
        } catch (err) { console.warn('Pending sync failed:', err); }
    };

    const fetchClients = useCallback(async () => {
        setLoading(true);
        await syncPendingClients();
        try {
            const res = await apiClient.get('/customers');
            const data = res.data?.data || res.data || [];

            const parsed = [];
            for (const c of data) {
                if (c.email && c.email.startsWith('||META:')) {
                    try {
                        const meta = JSON.parse(c.email.replace('||META:', ''));
                        if (meta.isPoultry) {
                            parsed.push({
                                ...c,
                                address: meta.address,
                                defaultDiscount: meta.defaultDiscount,
                                pendingAmount: meta.pendingAmount,
                                totalPurchase: meta.totalPurchase || 0,
                                categoryDiscounts: meta.categoryDiscounts || []
                            });
                        }
                    } catch (e) { /* skip */ }
                }
            }

            setClients(parsed);
            await AsyncStorage.setItem('poultry_clients', JSON.stringify(parsed));
        } catch (e) {
            // Silences expected 500 error logs during offline cache fetch
            try {
                const local = await AsyncStorage.getItem('poultry_clients');
                if (local) {
                    const localClients = JSON.parse(local).filter((c: any) => c.isActive !== false);
                    setClients(localClients);
                }
            } catch (err) {
                console.warn('Offline fallback failed:', err);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchClients();
        }, [fetchClients])
    );

    const openAdd = () => {
        setEditingClient(null);
        setForm({ name: '', phone: '', address: '', defaultDiscount: '0', pendingAmount: '0', categoryDiscounts: [] });
        setShowModal(true);
    };

    const openEdit = (client: PoultryClient) => {
        setEditingClient(client);
        setForm({
            name: client.name,
            phone: client.phone || '',
            address: client.address || '',
            defaultDiscount: String(client.defaultDiscount ?? 0),
            pendingAmount: String(client.pendingAmount ?? 0),
            categoryDiscounts: (client.categoryDiscounts || []).map(d => ({ ...d, discount: String(d.discount ?? (d as any).value ?? 0) }))
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { Alert.alert('Error', 'Client name is required'); return; }
        setSaving(true);
        const meta = {
            isPoultry: true,
            address: form.address.trim(),
            defaultDiscount: parseFloat(form.defaultDiscount) || 0,
            pendingAmount: parseFloat(form.pendingAmount) || 0,
            categoryDiscounts: form.categoryDiscounts.map(d => ({ ...d, discount: parseFloat(d.discount) || 0 }))
        };
        const payload = {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: '||META:' + JSON.stringify(meta)
        };
        try {
            // The backend handles both Create and Update under POST using phone number as the unique identifier
            await apiClient.post('/customers', payload);

            setShowModal(false);
            await fetchClients();
        } catch (e) {
            try {
                const tempId = String(Date.now());
                const offlinePayload = { name: payload.name, phone: payload.phone, ...meta };
                const updated = editingClient
                    ? clients.map(c => ((c._id || c.id) === (editingClient._id || editingClient.id) ? { ...c, ...offlinePayload } : c))
                    : [...clients, { id: tempId, ...offlinePayload, totalPurchase: 0, lastPurchase: new Date().toISOString().split('T')[0] }];

                setClients(updated);
                await AsyncStorage.setItem('poultry_clients', JSON.stringify(updated));

                // Queue the new client for sync when server is back online
                if (!editingClient) {
                    const rawPending = await AsyncStorage.getItem(PENDING_KEY);
                    const pending = rawPending ? JSON.parse(rawPending) : [];
                    pending.push({ id: tempId, ...offlinePayload, totalPurchase: 0 });
                    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
                }
                setShowModal(false);
            } catch (err) {
                Alert.alert('Error', 'Failed to save client locally.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (!editingClient) return;
        const id = editingClient._id || editingClient.id;
        Alert.alert('Delete Customer', 'Are you sure you want to delete this customer? This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setSaving(true);
                    try {
                        // Standard delete if it exists on server (Real Java IDs are Longs, whereas offline fallback temp IDs are 13-digit Date.now)
                        if (String(id).length < 13) {
                            await apiClient.delete(`/customers/${id}`);
                        }
                        const updated = clients.filter(c => (c._id || c.id) !== id);
                        setClients(updated);
                        await AsyncStorage.setItem('poultry_clients', JSON.stringify(updated));

                        const rawPending = await AsyncStorage.getItem(PENDING_KEY);
                        if (rawPending) {
                            const pending = JSON.parse(rawPending).filter((c: any) => c.id !== id);
                            await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
                        }

                        setShowModal(false);
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete customer from server. It might be linked to orders.', [{ text: 'OK' }]);
                    } finally {
                        setSaving(false);
                    }
                }
            }
        ]);
    };

    const filtered = clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    );

    const s = styles(colors, isDark);

    const renderClient = ({ item }: { item: PoultryClient }) => (
        <TouchableOpacity style={s.card} onPress={() => openEdit(item)}>
            <View style={s.cardAvatar}>
                <Text style={s.cardAvatarText}>{item.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={s.cardBody}>
                <Text style={s.cardName}>{item.name}</Text>
                {item.phone ? <Text style={s.cardSub}>📞 {item.phone}</Text> : null}
                <View style={s.cardRow}>
                    {item.defaultDiscount > 0 && (
                        <View style={s.discountBadge}>
                            <Text style={s.discountBadgeText}>{item.defaultDiscount}% off</Text>
                        </View>
                    )}
                    {item.pendingAmount > 0 && (
                        <View style={s.pendingBadge}>
                            <Text style={s.pendingBadgeText}>₹{item.pendingAmount} pending</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={s.container}>
            <View style={[s.header, { paddingTop: insets.top + 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={s.title}>Customers</Text>

                <TouchableOpacity
                    onPress={() => navigation.navigate('PoultryPOS')}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 12,
                        gap: 8,
                        elevation: 2,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4
                    }}
                >
                    <Ionicons name="receipt" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
                    <Text style={{ color: isDark ? '#FFFFFF' : '#000000', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>BILL</Text>
                </TouchableOpacity>
            </View>

            <View style={s.searchBar}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search clients..."
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, i) => String(item._id || item.id || i)}
                    renderItem={renderClient}
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 15 }}>No clients yet. Tap + Add to create one.</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity style={s.fab} onPress={openAdd}>
                <Ionicons name="add" size={28} color="#0f172a" />
            </TouchableOpacity>

            {/* Add / Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHandle} />
                        <Text style={s.modalTitle}>{editingClient ? 'Edit Client' : 'Add New Client'}</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {(['name', 'phone', 'address'] as const).map(field => (
                                <View key={field} style={s.formGroup}>
                                    <Text style={s.formLabel}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
                                    <TextInput
                                        style={s.formInput}
                                        value={form[field]}
                                        onChangeText={v => setForm({ ...form, [field]: v })}
                                        placeholder={field === 'name' ? 'e.g. Raju Hotel' : field === 'phone' ? '9876543210' : 'Street, area…'}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
                                    />
                                </View>
                            ))}
                            <View style={s.formRow}>
                                <View style={[s.formGroup, { flex: 1 }]}>
                                    <Text style={s.formLabel}>Default Discount (%)</Text>
                                    <TextInput style={s.formInput} value={form.defaultDiscount}
                                        onChangeText={v => setForm({ ...form, defaultDiscount: v })}
                                        keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                                </View>
                                <View style={{ width: 14 }} />
                                <View style={[s.formGroup, { flex: 1 }]}>
                                    <Text style={s.formLabel}>Opening Pending (₹)</Text>
                                    <TextInput style={s.formInput} value={form.pendingAmount}
                                        onChangeText={v => setForm({ ...form, pendingAmount: v })}
                                        keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                                </View>
                            </View>

                            <View style={{ marginTop: 20 }}>
                                <Text style={s.modalSubTitle}>Category Discounts (Overrides Default)</Text>
                                {form.categoryDiscounts.map((discount, index) => (
                                    <View key={index} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                                        <View style={{ flex: 1.5 }}>
                                            <Text style={s.formLabel}>Category</Text>
                                            <TextInput style={[s.formInput, { padding: 9, fontSize: 13 }]} value={discount.category} onChangeText={v => { const n = [...form.categoryDiscounts]; n[index].category = v; setForm({ ...form, categoryDiscounts: n }); }} placeholder="e.g. Chicken" placeholderTextColor={colors.textMuted} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.formLabel}>Type</Text>
                                            <TouchableOpacity onPress={() => { const n = [...form.categoryDiscounts]; n[index].type = n[index].type === 'amount' ? 'percentage' : 'amount'; setForm({ ...form, categoryDiscounts: n }); }} style={[s.formInput, { justifyContent: 'center', padding: 9, backgroundColor: colors.background }]}>
                                                <Text style={{ color: colors.textPrimary || (colors as any).text, fontSize: 13, textAlign: 'center' }}>{discount.type === 'amount' ? '₹' : '%'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.formLabel}>Value</Text>
                                            <TextInput style={[s.formInput, { padding: 9, fontSize: 13 }]} value={discount.discount} onChangeText={v => { const n = [...form.categoryDiscounts]; n[index].discount = v; setForm({ ...form, categoryDiscounts: n }); }} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                                        </View>
                                        <TouchableOpacity onPress={() => { const n = [...form.categoryDiscounts]; n.splice(index, 1); setForm({ ...form, categoryDiscounts: n }); }} style={{ padding: 8, alignSelf: 'flex-end', marginBottom: 2 }}>
                                            <Ionicons name="trash" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8, padding: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8 }} onPress={() => setForm({ ...form, categoryDiscounts: [...form.categoryDiscounts, { category: '', type: 'amount', discount: '0' }] })}>
                                    <Ionicons name="add" size={16} color="#10b981" />
                                    <Text style={{ color: '#10b981', fontWeight: '600' }}>Add Category Discount</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        {editingClient && (
                            <TouchableOpacity style={s.deleteRowBtn} onPress={handleDelete} disabled={saving}>
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                <Text style={s.deleteBtnText}>Delete Customer</Text>
                            </TouchableOpacity>
                        )}
                        <View style={s.modalActions}>
                            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                                <Text style={s.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator size="small" color="#0f172a" /> : <Text style={s.saveBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = (colors: any, isDark: boolean) => {
    const safeText = isDark ? '#FFFFFF' : (colors.text || '#000000');
    const safeMuted = isDark ? '#94a3b8' : colors.textMuted;

    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 3, zIndex: 10 },
        title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: safeText, marginTop: 4 },
        searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 24, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: colors.border },
        searchInput: { flex: 1, fontSize: 16, color: safeText, fontFamily: 'Inter_400Regular' },
        card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: colors.border },
        cardAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
        cardAvatarText: { color: isDark ? '#000' : '#0f172a', fontFamily: 'Inter_700Bold', fontSize: 18 },
        cardBody: { flex: 1 },
        cardName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: safeText, marginBottom: 4 },
        cardSub: { fontSize: 13, color: safeMuted, marginBottom: 6, fontFamily: 'Inter_400Regular' },
        cardRow: { flexDirection: 'row', gap: 8 },
        discountBadge: { backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
        discountBadgeText: { color: '#10b981', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
        pendingBadge: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
        pendingBadgeText: { color: '#ef4444', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
        cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
        totalLabel: { fontSize: 12, color: safeMuted, fontFamily: 'Inter_400Regular', marginBottom: 2 },
        totalValue: { fontSize: 17, fontFamily: 'Inter_700Bold', color: safeText },
        // FAB
        fab: { position: 'absolute', bottom: 100, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, zIndex: 99 },
        // Modal
        modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
        modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '90%' },
        modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
        modalTitle: { fontSize: 19, fontWeight: '700', color: safeText, marginBottom: 20 },
        modalSubTitle: { fontSize: 14, fontWeight: '700', color: safeText, marginBottom: 12 },
        formGroup: { marginBottom: 14 },
        formRow: { flexDirection: 'row' },
        formLabel: { fontSize: 12, fontWeight: '600', color: safeMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
        formInput: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: safeText, fontSize: 15 },
        modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
        cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
        cancelBtnText: { color: safeText, fontWeight: '600' },
        saveBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
        saveBtnText: { color: isDark ? '#000' : '#0f172a', fontWeight: '700', fontSize: 15 },
        deleteRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)' },
        deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 }
    });
};
