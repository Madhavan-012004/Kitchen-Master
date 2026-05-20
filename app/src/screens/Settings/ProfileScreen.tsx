import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal,
    ActivityIndicator, TextInput, FlatList, SafeAreaView, StatusBar, Switch, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/useAuthStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import apiClient from '../../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
type Section =
    | 'general' | 'printer' | 'pos_behavior' | 'online' | 'whatsapp'
    | 'stakeholder' | 'tables' | null;

// ─── Helper Components ────────────────────────────────────────────────────────
function SectionHeader({ title, icon, isOpen, onToggle, colors }: any) {
    return (
        <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onToggle}
            activeOpacity={0.7}
        >
            <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionHeaderIcon}>{icon}</Text>
                <Text style={[styles.sectionHeaderText, { color: colors.textPrimary }]}>{title}</Text>
            </View>
            <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
            />
        </TouchableOpacity>
    );
}

function SettingRow({ label, description, children, colors }: any) {
    return (
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
                {description ? (
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>{description}</Text>
                ) : null}
            </View>
            <View style={styles.settingControl}>{children}</View>
        </View>
    );
}

function FormField({ label, value, onChange, keyboardType = 'default', placeholder = '', multiline = false, colors }: any) {
    return (
        <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
            <TextInput
                style={[
                    styles.fieldInput,
                    { color: colors.textPrimary, backgroundColor: colors.glass, borderColor: colors.border },
                    multiline && { height: 80, textAlignVertical: 'top', paddingTop: 10 },
                ]}
                value={value}
                onChangeText={onChange}
                keyboardType={keyboardType}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                multiline={multiline}
            />
        </View>
    );
}

function SelectField({ label, value, options, onChange, colors }: any) {
    const [open, setOpen] = useState(false);
    const selected = options.find((o: any) => o.value === value);
    return (
        <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
            <TouchableOpacity
                style={[styles.fieldInput, styles.selectBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
                onPress={() => setOpen(true)}
            >
                <Text style={{ color: colors.textPrimary, flex: 1 }}>{selected?.label || value}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <Modal visible={open} transparent animationType="fade">
                <TouchableOpacity style={styles.selectOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
                    <View style={[styles.selectMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {options.map((opt: any) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.selectOption, { borderBottomColor: colors.border }]}
                                onPress={() => { onChange(opt.value); setOpen(false); }}
                            >
                                <Text style={{ color: opt.value === value ? colors.primary : colors.textPrimary, fontWeight: opt.value === value ? '700' : '400' }}>
                                    {opt.label}
                                </Text>
                                {opt.value === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const { user, logout, updateProfile, isLoading: isAuthLoading } = useAuthStore();
    const { isActive, checkIn, checkOut, isLoading: isAttendanceLoading, checkInTime } = useAttendanceStore();

    // ── Map / Location ────────────────────────────────────────────────────────
    const [showMap, setShowMap] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const mapRef = useRef<MapView>(null);

    // ── Accordion ─────────────────────────────────────────────────────────────
    const [openSection, setOpenSection] = useState<Section>('general');
    const toggleSection = (s: Section) => setOpenSection(prev => prev === s ? null : s);

    // ── Form Data ─────────────────────────────────────────────────────────────
    const parseJson = (val: any, fallback: any) => {
        if (!val) return fallback;
        if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
        return val;
    };

    const [form, setForm] = useState(() => ({
        name: user?.name || '',
        restaurantName: user?.restaurantName || '',
        phone: user?.phone || '',
        address: user?.address || '',
        currency: user?.currency || 'INR',
        gstNumber: user?.gstNumber || '',
        taxRate: String(user?.taxRate ?? 5),
        geofenceRadius: String(user?.geofenceRadius ?? 500),
        totalTables: String(user?.totalTables ?? 10),
        acTables: user?.acTables || '',
        acChargePercentage: String(user?.acChargePercentage ?? 20),
        tableMetadata: parseJson(user?.tableMetadata, {}),
        tableCategories: parseJson(user?.tableCategories, []),

        // Printer
        billPrinterEnabled: user?.billPrinterEnabled ?? true,
        counterPrinterIp: user?.counterPrinterIp || '',
        kotPrinterEnabled: user?.kotPrinterEnabled ?? true,
        kitchenPrinterIp: user?.kitchenPrinterIp || '',
        autoPrintEnabled: user?.autoPrintEnabled ?? false,
        largeFontKOT: user?.largeFontKOT ?? false,
        itemWiseKOT: user?.itemWiseKOT ?? false,
        consolidatedReceipt: user?.consolidatedReceipt ?? false,
        minPrintPrice: String(user?.minPrintPrice ?? 0),
        printCount: String(user?.printCount ?? 1),
        reprintKOT: user?.reprintKOT ?? false,
        reprintBill: user?.reprintBill ?? false,
        customPrinters: parseJson(user?.customPrinters, []),

        // POS Behavior
        quickMode: user?.quickMode ?? false,
        manualQuantity: user?.manualQuantity ?? false,
        preferredPosMode: user?.preferredPosMode || 'restaurant',
        menuLayout: user?.menuLayout || 'Side Menu',
        menuItemColumnCount: String(user?.menuItemColumnCount ?? 5),
        lowStockAlert: user?.lowStockAlert ?? true,
        allowNoStockSale: user?.allowNoStockSale ?? true,
        trackCustomerDetail: user?.trackCustomerDetail ?? true,

        // Online Orders
        onlineAutoAccept: user?.onlineAutoAccept ?? false,
        onlineAutoPrint: user?.onlineAutoPrint ?? false,
        onlinePrintCounter: user?.onlinePrintCounter ?? true,
        onlinePrintKitchen: user?.onlinePrintKitchen ?? true,
        onlineNotification: user?.onlineNotification ?? true,
        onlineStockActivateTime: user?.onlineStockActivateTime ?? false,

        // WhatsApp
        whatsappCountryCode: user?.whatsappCountryCode || '+91',
        whatsappDetailedBill: user?.whatsappDetailedBill ?? false,

        // Language
        preferredLanguage: user?.preferredLanguage || 'en',
        printLanguage: user?.printLanguage || 'en',
    }));

    const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    // ── Stakeholders ──────────────────────────────────────────────────────────
    const [stakeholders, setStakeholders] = useState<any[]>([]);
    const [loadingStakeholders, setLoadingStakeholders] = useState(false);
    const [stakeholderForm, setStakeholderForm] = useState({ name: '', phone: '', sharePercentage: '50', password: '' });

    const loadStakeholders = async () => {
        if (user?.role !== 'owner') return;
        setLoadingStakeholders(true);
        try {
            const res = await apiClient.get('/stakeholder/list');
            if (res.data.success) setStakeholders(res.data.data.stakeholders || []);
        } catch (err) { console.error(err); }
        finally { setLoadingStakeholders(false); }
    };

    React.useEffect(() => { if (user?.role === 'owner') loadStakeholders(); }, []);

    const handleInviteStakeholder = async () => {
        if (!stakeholderForm.name || !stakeholderForm.phone || !stakeholderForm.password) {
            Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Fill all stakeholder fields.' });
            return;
        }
        setIsSaving(true);
        try {
            const res = await apiClient.post('/stakeholder/invite', {
                ...stakeholderForm,
                sharePercentage: Number(stakeholderForm.sharePercentage)
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Invited!', text2: 'Stakeholder added.' });
                setStakeholderForm({ name: '', phone: '', sharePercentage: '50', password: '' });
                loadStakeholders();
            }
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.message || err.message });
        } finally { setIsSaving(false); }
    };

    const handleRemoveStakeholder = (id: string) => {
        Alert.alert('Remove Stakeholder', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.post('/stakeholder/remove', { stakeholderId: id });
                        Toast.show({ type: 'success', text1: 'Removed' });
                        loadStakeholders();
                    } catch (err: any) {
                        Toast.show({ type: 'error', text1: 'Error', text2: err.message });
                    }
                }
            }
        ]);
    };

    // ── Custom Printers ───────────────────────────────────────────────────────
    const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', type: 'bill' });

    const addCustomPrinter = () => {
        if (!newPrinter.name.trim() || !newPrinter.ip.trim()) return;
        set('customPrinters', [...(form.customPrinters || []), { ...newPrinter, id: Date.now() }]);
        setNewPrinter({ name: '', ip: '', type: 'bill' });
    };

    const removeCustomPrinter = (id: number) => {
        set('customPrinters', form.customPrinters.filter((p: any) => p.id !== id));
    };

    // ── Save Profile ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: any = {
                ...form,
                taxRate: parseFloat(form.taxRate) || 5,
                geofenceRadius: parseInt(form.geofenceRadius) || 500,
                totalTables: parseInt(form.totalTables) || 10,
                acChargePercentage: parseFloat(form.acChargePercentage) || 0,
                minPrintPrice: parseFloat(form.minPrintPrice) || 0,
                printCount: parseInt(form.printCount) || 1,
                menuItemColumnCount: parseInt(form.menuItemColumnCount) || 5,
                tableMetadata: JSON.stringify(form.tableMetadata),
                tableCategories: JSON.stringify(form.tableCategories),
                customPrinters: JSON.stringify(form.customPrinters),
            };
            await updateProfile(payload);
            Toast.show({ type: 'success', text1: '✅ Saved', text2: 'Settings updated!' });
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Save Failed', text2: err.response?.data?.message || err.message });
        } finally { setIsSaving(false); }
    };

    // ── Location ──────────────────────────────────────────────────────────────
    const handleUpdateLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Enable location access.' });
            return;
        }
        setIsSaving(true);
        setShowMap(true);
        try {
            const lastLoc = await Location.getLastKnownPositionAsync({});
            const currentCoords = {
                latitude: lastLoc?.coords.latitude || user?.latitude || 12.9716,
                longitude: lastLoc?.coords.longitude || user?.longitude || 77.5946,
            };
            setPendingCoords(currentCoords);
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const finalCoords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
            setPendingCoords(finalCoords);
            mapRef.current?.animateToRegion({ ...finalCoords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
        } catch (err) { console.log('Location fetch failed', err); }
        finally { setIsSaving(false); }
    };

    const handleConfirmLocation = async () => {
        if (!pendingCoords) return;
        setIsSaving(true);
        try {
            let address = user?.address || '';
            try {
                const [result] = await Location.reverseGeocodeAsync(pendingCoords);
                if (result) {
                    address = [result.name, result.street, result.city, result.region, result.postalCode].filter(Boolean).join(', ');
                }
            } catch { }
            await updateProfile({ latitude: pendingCoords.latitude, longitude: pendingCoords.longitude, address });
            set('address', address);
            setShowMap(false);
            Toast.show({ type: 'success', text1: 'Location Updated!' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
        } finally { setIsSaving(false); }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) { setSearchResults([]); return; }
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            setSearchResults(data);
        } catch { }
    };

    const selectSearchResult = (item: any) => {
        const coords = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
        setPendingCoords(coords);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 });
        setSearchResults([]);
        setSearchQuery('');
    };

    // ── Bulk Menu Upload ──────────────────────────────────────────────────────
    const handleBulkMenuUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;
            const file = result.assets[0];
            const formData = new FormData();
            formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
            Toast.show({ type: 'info', text1: 'Uploading...', text2: 'Processing menu file.' });
            const res = await apiClient.post('/menu/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Import Success', text2: `Imported ${res.data.data.count} items!` });
            }
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Upload Failed', text2: error.response?.data?.message || error.message });
        }
    };

    // ── Attendance ────────────────────────────────────────────────────────────
    const handleAttendanceAction = async () => {
        if (isActive) {
            try {
                await checkOut();
                Toast.show({ type: 'success', text1: 'Shift Ended', text2: 'Take some rest!' });
            } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Error', text2: err.message });
            }
        } else {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location required.' });
                return;
            }
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                await checkIn(loc.coords.latitude, loc.coords.longitude);
                Toast.show({ type: 'success', text1: 'Shift Started', text2: 'Have a great day!' });
            } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Check-in Failed', text2: err.response?.data?.message || err.message });
            }
        }
    };

    if (!user) return null;

    const roleColors: Record<string, string> = {
        owner: colors.primary,
        manager: colors.accentBlue || '#4C8EFF',
        waiter: colors.warning,
        kitchen: colors.error,
        inventory: colors.accentPurple || '#A855F7',
    };
    const roleColor = roleColors[user.role] || colors.textSecondary;
    
    const canEdit = ['owner', 'manager', 'stakeholder'].includes(user.role.toLowerCase());

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFillObject} />
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: Platform.OS === 'ios' ? 60 : 48 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Profile Card ── */}
                <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.profileCardTop}>
                        <LinearGradient colors={gradients.primary} style={styles.avatar}>
                            <Text style={[styles.avatarText, { color: colors.white }]}>{user.name.charAt(0).toUpperCase()}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1, marginLeft: Spacing.lg }}>
                            <Text style={[styles.name, { color: colors.textPrimary }]}>{user.name}</Text>
                            <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
                            <View style={[styles.roleBadge, { borderColor: roleColor, backgroundColor: `${roleColor}15` }]}>
                                <Text style={[styles.roleText, { color: roleColor }]}>{user.role.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={styles.restaurantRow}>
                        <Ionicons name="restaurant-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.restaurantText, { color: colors.textSecondary }]}>{user.restaurantName}</Text>
                    </View>
                </View>

                {/* ── Read Only Banner ── */}
                {!canEdit && (
                    <View style={{ backgroundColor: colors.error + '1A', borderColor: colors.error + '40', borderWidth: 1, padding: 16, borderRadius: Radius.lg, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="lock-closed" size={24} color={colors.error} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 14 }}>Read-Only Mode</Text>
                            <Text style={{ color: colors.error, fontSize: 12, opacity: 0.8, marginTop: 2 }}>Only Managers and Owners can edit settings.</Text>
                        </View>
                    </View>
                )}

                {/* ── Save Button ── */}
                {canEdit && (
                    <TouchableOpacity
                        style={[styles.saveAllBtn, { opacity: isSaving ? 0.7 : 1 }]}
                        onPress={handleSave}
                        disabled={isSaving}
                        activeOpacity={0.8}
                    >
                        <LinearGradient colors={gradients.primary} style={styles.saveAllGradient}>
                            {isSaving
                                ? <ActivityIndicator color={colors.white} size="small" />
                                : <><Ionicons name="save-outline" size={18} color={colors.white} /><Text style={[styles.saveAllText, { color: colors.white }]}>Save All Settings</Text></>
                            }
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: GENERAL SETTINGS
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="General Details"
                        icon="⚙️"
                        isOpen={openSection === 'general'}
                        onToggle={() => toggleSection('general')}
                        colors={colors}
                    />
                )}
                {openSection === 'general' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        <FormField label="Your Name" value={form.name} onChange={(v: string) => set('name', v)} placeholder="Full Name" colors={colors} />
                        <FormField label="Restaurant Name" value={form.restaurantName} onChange={(v: string) => set('restaurantName', v)} placeholder="Legal Name" colors={colors} />
                        <FormField label="Phone" value={form.phone} onChange={(v: string) => set('phone', v)} placeholder="+91 ..." keyboardType="phone-pad" colors={colors} />
                        <FormField label="GST Number" value={form.gstNumber} onChange={(v: string) => set('gstNumber', v)} placeholder="22AAAAA0000A1Z5" colors={colors} />
                        <FormField label="Currency Code" value={form.currency} onChange={(v: string) => set('currency', v)} placeholder="INR" colors={colors} />
                        <FormField label="Tax Rate (%)" value={form.taxRate} onChange={(v: string) => set('taxRate', v)} keyboardType="numeric" placeholder="5" colors={colors} />
                        <FormField label="Address" value={form.address} onChange={(v: string) => set('address', v)} multiline placeholder="Restaurant address..." colors={colors} />
                        <SelectField
                            label="UI Language"
                            value={form.preferredLanguage}
                            onChange={(v: string) => set('preferredLanguage', v)}
                            options={[{ label: '🇬🇧 English', value: 'en' }, { label: '🇮🇳 Tamil (தமிழ்)', value: 'ta' }]}
                            colors={colors}
                        />
                        <SelectField
                            label="Print Language"
                            value={form.printLanguage}
                            onChange={(v: string) => set('printLanguage', v)}
                            options={[{ label: '🇬🇧 English', value: 'en' }, { label: '🇮🇳 Tamil (தமிழ்)', value: 'ta' }]}
                            colors={colors}
                        />

                        {/* Location update button */}
                        {user.role === 'owner' && (
                            <TouchableOpacity
                                style={[styles.inlineBtn, { backgroundColor: (colors.success || '#22c55e') + '1A', borderColor: (colors.success || '#22c55e') + '40' }]}
                                onPress={handleUpdateLocation}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="location-outline" size={18} color={colors.success || '#22c55e'} />
                                <Text style={[styles.inlineBtnText, { color: colors.success || '#22c55e' }]}>Set Restaurant Location on Map</Text>
                            </TouchableOpacity>
                        )}

                        <FormField label="Geofence Radius (m)" value={form.geofenceRadius} onChange={(v: string) => set('geofenceRadius', v)} keyboardType="numeric" colors={colors} />
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: TABLE CONFIG
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="Table Configuration"
                        icon="🪑"
                        isOpen={openSection === 'tables'}
                        onToggle={() => toggleSection('tables')}
                        colors={colors}
                    />
                )}
                {openSection === 'tables' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        <FormField label="Total Tables" value={form.totalTables} onChange={(v: string) => set('totalTables', v)} keyboardType="numeric" colors={colors} />
                        <FormField label="AC Tables (comma separated, e.g. 1,3,5)" value={form.acTables} onChange={(v: string) => set('acTables', v)} placeholder="Not specified" colors={colors} />
                        <FormField label="AC Charge (%)" value={form.acChargePercentage} onChange={(v: string) => set('acChargePercentage', v)} keyboardType="numeric" colors={colors} />

                        <Text style={[styles.subLabel, { color: colors.textMuted }]}>Table Details (Seats &amp; Area)</Text>
                        {Array.from({ length: parseInt(form.totalTables) || 0 }, (_, i) => String(i + 1)).map(num => (
                            <View key={num} style={[styles.tableCard, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                <Text style={[styles.tableCardTitle, { color: colors.textPrimary }]}>Table {num}</Text>
                                <View style={styles.tableCardRow}>
                                    <View style={styles.tableCardInput}>
                                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Seats</Text>
                                        <TextInput
                                            style={[styles.fieldInput, { color: colors.textPrimary, backgroundColor: colors.card, borderColor: colors.border }]}
                                            value={String(form.tableMetadata[num]?.seats || '')}
                                            onChangeText={v => set('tableMetadata', { ...form.tableMetadata, [num]: { ...form.tableMetadata[num], seats: v } })}
                                            keyboardType="numeric"
                                            placeholder="4"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                    <View style={styles.tableCardInput}>
                                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Area</Text>
                                        <View style={[styles.areaTabRow, { backgroundColor: colors.card }]}>
                                            {['AC', 'Non-AC'].map(loc => (
                                                <TouchableOpacity
                                                    key={loc}
                                                    style={[styles.areaTab, form.tableMetadata[num]?.location === loc && { backgroundColor: colors.primary }]}
                                                    onPress={() => set('tableMetadata', { ...form.tableMetadata, [num]: { ...form.tableMetadata[num], location: loc } })}
                                                >
                                                    <Text style={[styles.areaTabText, { color: form.tableMetadata[num]?.location === loc ? colors.white : colors.textMuted }]}>{loc}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: PRINTER SETTINGS
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="Printer Settings"
                        icon="🖨️"
                        isOpen={openSection === 'printer'}
                        onToggle={() => toggleSection('printer')}
                        colors={colors}
                    />
                )}
                {openSection === 'printer' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        {/* Bill Printer */}
                        <SettingRow label="Bill / Counter Printer" description="Enable thermal bill printing" colors={colors}>
                            <Switch value={form.billPrinterEnabled} onValueChange={v => set('billPrinterEnabled', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        {form.billPrinterEnabled && (
                            <FormField label="Counter Printer IP" value={form.counterPrinterIp} onChange={(v: string) => set('counterPrinterIp', v)} placeholder="192.168.1.50" keyboardType="numeric" colors={colors} />
                        )}

                        {/* KOT Printer */}
                        <SettingRow label="Kitchen / KOT Printer" description="Print order tickets to kitchen" colors={colors}>
                            <Switch value={form.kotPrinterEnabled} onValueChange={v => set('kotPrinterEnabled', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        {form.kotPrinterEnabled && (
                            <FormField label="Kitchen Printer IP" value={form.kitchenPrinterIp} onChange={(v: string) => set('kitchenPrinterIp', v)} placeholder="192.168.1.51" keyboardType="numeric" colors={colors} />
                        )}

                        <SettingRow label="Auto Print on Order" description="Automatically print bill when order is placed" colors={colors}>
                            <Switch value={form.autoPrintEnabled} onValueChange={v => set('autoPrintEnabled', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <SettingRow label="Item-Wise KOT" description="Print one KOT slip per item" colors={colors}>
                            <Switch value={form.itemWiseKOT} onValueChange={v => set('itemWiseKOT', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <SettingRow label="Large Font KOT" description="Bigger text for kitchen readability" colors={colors}>
                            <Switch value={form.largeFontKOT} onValueChange={v => set('largeFontKOT', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <SettingRow label="Consolidated Receipt" description="Merge all items into one receipt" colors={colors}>
                            <Switch value={form.consolidatedReceipt} onValueChange={v => set('consolidatedReceipt', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <SettingRow label="Reprint KOT" description="Allow reprinting kitchen tickets" colors={colors}>
                            <Switch value={form.reprintKOT} onValueChange={v => set('reprintKOT', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <SettingRow label="Reprint Bill" description="Allow reprinting bills from history" colors={colors}>
                            <Switch value={form.reprintBill} onValueChange={v => set('reprintBill', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>

                        <FormField label="Min. Order Amount to Print (₹)" value={form.minPrintPrice} onChange={(v: string) => set('minPrintPrice', v)} keyboardType="numeric" colors={colors} />
                        <FormField label="Print Count (Copies)" value={form.printCount} onChange={(v: string) => set('printCount', v)} keyboardType="numeric" colors={colors} />

                        {/* Custom Printers */}
                        <View style={[styles.subSection, { borderTopColor: colors.border }]}>
                            <Text style={[styles.subLabel, { color: colors.textPrimary }]}>🖨️ Custom Printers</Text>
                            <Text style={[styles.subDesc, { color: colors.textMuted }]}>Configure additional printers for specific routing</Text>

                            {(form.customPrinters || []).map((printer: any) => (
                                <View key={printer.id} style={[styles.customPrinterRow, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.printerName, { color: colors.textPrimary }]}>{printer.name}</Text>
                                        <Text style={[styles.printerIp, { color: colors.textMuted }]}>{printer.ip} • {printer.type}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeCustomPrinter(printer.id)} style={[styles.removeBtn, { backgroundColor: colors.error + '1A' }]}>
                                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>Add New Printer</Text>
                            <FormField label="Printer Name" value={newPrinter.name} onChange={(v: string) => setNewPrinter(p => ({ ...p, name: v }))} placeholder="e.g. Bar Printer" colors={colors} />
                            <FormField label="IP Address" value={newPrinter.ip} onChange={(v: string) => setNewPrinter(p => ({ ...p, ip: v }))} placeholder="192.168.1.100" keyboardType="numeric" colors={colors} />
                            <SelectField
                                label="Type"
                                value={newPrinter.type}
                                onChange={(v: string) => setNewPrinter(p => ({ ...p, type: v }))}
                                options={[{ label: 'Bill / Receipt', value: 'bill' }, { label: 'KOT Printer', value: 'kot' }, { label: 'Labels', value: 'label' }]}
                                colors={colors}
                            />
                            <TouchableOpacity
                                style={[styles.inlineBtn, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '40', opacity: (!newPrinter.name || !newPrinter.ip) ? 0.5 : 1 }]}
                                onPress={addCustomPrinter}
                                disabled={!newPrinter.name || !newPrinter.ip}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                                <Text style={[styles.inlineBtnText, { color: colors.primary }]}>Add Printer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: POS BEHAVIOR
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="POS &amp; App Behavior"
                        icon="🏪"
                        isOpen={openSection === 'pos_behavior'}
                        onToggle={() => toggleSection('pos_behavior')}
                        colors={colors}
                    />
                )}
                {openSection === 'pos_behavior' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        <SettingRow label="Quick Mode" description="Skip confirmations for faster billing" colors={colors}>
                            <Switch value={form.quickMode} onValueChange={v => set('quickMode', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Manual Quantity Entry" description="Type quantities instead of +/- buttons" colors={colors}>
                            <Switch value={form.manualQuantity} onValueChange={v => set('manualQuantity', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Low Stock Alert" description="Notify when inventory is running low" colors={colors}>
                            <Switch value={form.lowStockAlert} onValueChange={v => set('lowStockAlert', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Allow Out-of-Stock Sale" description="Sell items even when stock is zero" colors={colors}>
                            <Switch value={form.allowNoStockSale} onValueChange={v => set('allowNoStockSale', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Track Customer Details" description="Collect name/phone at billing" colors={colors}>
                            <Switch value={form.trackCustomerDetail} onValueChange={v => set('trackCustomerDetail', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SelectField
                            label="Preferred POS Mode"
                            value={form.preferredPosMode}
                            onChange={(v: string) => set('preferredPosMode', v)}
                            options={[{ label: '🍽️ Restaurant POS', value: 'restaurant' }, { label: '🛒 Supermarket POS', value: 'supermarket' }]}
                            colors={colors}
                        />
                        <SelectField
                            label="Menu Layout"
                            value={form.menuLayout}
                            onChange={(v: string) => set('menuLayout', v)}
                            options={[
                                { label: 'Side Menu (Default)', value: 'Side Menu' },
                                { label: 'Top Navigation', value: 'Top Menu' },
                                { label: 'Full Grid View', value: 'Grid' },
                            ]}
                            colors={colors}
                        />
                        <FormField label="Menu Item Columns" value={form.menuItemColumnCount} onChange={(v: string) => set('menuItemColumnCount', v)} keyboardType="numeric" placeholder="5" colors={colors} />
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: ONLINE ORDERS
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="Online Order Settings"
                        icon="🌐"
                        isOpen={openSection === 'online'}
                        onToggle={() => toggleSection('online')}
                        colors={colors}
                    />
                )}
                {openSection === 'online' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        <SettingRow label="Auto Accept Orders" description="Automatically accept incoming online orders" colors={colors}>
                            <Switch value={form.onlineAutoAccept} onValueChange={v => set('onlineAutoAccept', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Auto Print Online Orders" description="Print immediately when order arrives" colors={colors}>
                            <Switch value={form.onlineAutoPrint} onValueChange={v => set('onlineAutoPrint', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Print at Cash Counter" description="Send online orders to the counter printer" colors={colors}>
                            <Switch value={form.onlinePrintCounter} onValueChange={v => set('onlinePrintCounter', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Print at Kitchen" description="Send online orders to the kitchen printer" colors={colors}>
                            <Switch value={form.onlinePrintKitchen} onValueChange={v => set('onlinePrintKitchen', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Push Notifications" description="Get notified of new online orders" colors={colors}>
                            <Switch value={form.onlineNotification} onValueChange={v => set('onlineNotification', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                        <SettingRow label="Stock Activation Time" description="Schedule when out-of-stock items re-appear" colors={colors}>
                            <Switch value={form.onlineStockActivateTime} onValueChange={v => set('onlineStockActivateTime', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: WHATSAPP
                ═════════════════════════════════════════ */}
                {canEdit && (
                    <SectionHeader
                        title="WhatsApp Settings"
                        icon="💬"
                        isOpen={openSection === 'whatsapp'}
                        onToggle={() => toggleSection('whatsapp')}
                        colors={colors}
                    />
                )}
                {openSection === 'whatsapp' && canEdit && (
                    <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]} pointerEvents={canEdit ? 'auto' : 'none'}>
                        <FormField label="Country Code" value={form.whatsappCountryCode} onChange={(v: string) => set('whatsappCountryCode', v)} placeholder="+91" keyboardType="phone-pad" colors={colors} />
                        <SettingRow label="Detailed Bill on WhatsApp" description="Send itemized bill breakdown to customer" colors={colors}>
                            <Switch value={form.whatsappDetailedBill} onValueChange={v => set('whatsappDetailedBill', v)} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
                        </SettingRow>
                    </View>
                )}

                {/* ═══════════════════════════════════════
                    SECTION: STAKEHOLDER (OWNER ONLY)
                ═════════════════════════════════════════ */}
                {user.role === 'owner' && (
                    <>
                        <SectionHeader
                            title="Stakeholder Management"
                            icon="🤝"
                            isOpen={openSection === 'stakeholder'}
                            onToggle={() => toggleSection('stakeholder')}
                            colors={colors}
                        />
                        {openSection === 'stakeholder' && (
                            <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.subLabel, { color: colors.textPrimary }]}>Invite New Stakeholder</Text>
                                <FormField label="Name" value={stakeholderForm.name} onChange={(v: string) => setStakeholderForm(f => ({ ...f, name: v }))} colors={colors} />
                                <FormField label="Phone" value={stakeholderForm.phone} onChange={(v: string) => setStakeholderForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="+91..." colors={colors} />
                                <FormField label="Password" value={stakeholderForm.password} onChange={(v: string) => setStakeholderForm(f => ({ ...f, password: v }))} placeholder="Temporary password" colors={colors} />
                                <FormField label="Share (%)" value={stakeholderForm.sharePercentage} onChange={(v: string) => setStakeholderForm(f => ({ ...f, sharePercentage: v }))} keyboardType="numeric" colors={colors} />
                                <TouchableOpacity
                                    style={[styles.inlineBtn, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '40' }]}
                                    onPress={handleInviteStakeholder}
                                    disabled={isSaving}
                                >
                                    <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                                    <Text style={[styles.inlineBtnText, { color: colors.primary }]}>{isSaving ? 'Inviting...' : 'Send Invitation'}</Text>
                                </TouchableOpacity>

                                <View style={[styles.subSection, { borderTopColor: colors.border, marginTop: 20 }]}>
                                    <Text style={[styles.subLabel, { color: colors.textPrimary }]}>Current Stakeholders</Text>
                                    {loadingStakeholders
                                        ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                                        : stakeholders.filter((s: any) => s?.stakeholderUser != null).length === 0
                                            ? <Text style={[styles.subDesc, { color: colors.textMuted }]}>No stakeholders added yet.</Text>
                                            : stakeholders
                                                .filter((s: any) => s?.stakeholderUser != null)
                                                .map((s: any) => (
                                                <View key={s.stakeholderUser?._id ?? Math.random().toString()} style={[styles.customPrinterRow, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.printerName, { color: colors.textPrimary }]}>{s.stakeholderUser?.name ?? 'Unknown'}</Text>
                                                        <Text style={[styles.printerIp, { color: colors.textMuted }]}>{s.stakeholderUser?.phone ?? '—'} • {s.sharePercentage ?? 0}% share</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => s.stakeholderUser?._id && handleRemoveStakeholder(s.stakeholderUser._id)}
                                                        style={[styles.removeBtn, { backgroundColor: colors.error + '1A' }]}
                                                    >
                                                        <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                </View>
                            </View>
                        )}
                    </>
                )}

                {/* ═══════════════════════════════════════
                    QUICK ACTIONS
                ═════════════════════════════════════════ */}
                <View style={styles.quickActions}>
                    {['owner', 'manager'].includes(user.role) && (
                        <TouchableOpacity
                            style={[styles.actionRow, { backgroundColor: (colors.accentBlue || '#38bdf8') + '0D', borderColor: (colors.accentBlue || '#38bdf8') + '33' }]}
                            onPress={handleBulkMenuUpload}
                        >
                            <Ionicons name="cloud-upload-outline" size={22} color={colors.accentBlue || '#38bdf8'} />
                            <Text style={[styles.actionText, { color: colors.accentBlue || '#38bdf8' }]}>Upload Menu (CSV / Excel)</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.accentBlue || '#38bdf8'} />
                        </TouchableOpacity>
                    )}

                    {user.role === 'owner' && (
                        <TouchableOpacity style={[styles.actionRow, { backgroundColor: colors.glass, borderColor: colors.border }]} onPress={() => navigation.navigate('EmployeeManagement')}>
                            <Ionicons name="people-outline" size={22} color={colors.primary} />
                            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Manage Staff &amp; Roles</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}

                    {__DEV__ && user.role !== 'waiter' && (
                        <TouchableOpacity style={[styles.actionRow, { backgroundColor: colors.glass, borderColor: colors.border }]} onPress={() => navigation.navigate('ServerConfig')}>
                            <Ionicons name="server-outline" size={22} color={colors.textPrimary} />
                            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Server Configuration</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[styles.actionRow, { backgroundColor: colors.glass, borderColor: colors.border }]} onPress={() => navigation.navigate('AppSettings')}>
                        <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>App Preferences (Theme &amp; Language)</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionRow, { backgroundColor: colors.glass, borderColor: colors.border }]} onPress={() => navigation.navigate('HelpSupport')}>
                        <Ionicons name="help-buoy-outline" size={22} color={colors.textPrimary} />
                        <Text style={[styles.actionText, { color: colors.textPrimary }]}>Help &amp; Support</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>

                    {/* Attendance for non-owners */}
                    {user.role !== 'owner' && (
                        <TouchableOpacity
                            style={[styles.attendanceBtn, isActive ? { backgroundColor: colors.success || '#22c55e', borderColor: colors.success || '#22c55e' } : { backgroundColor: colors.primary, borderColor: colors.primary }]}
                            onPress={handleAttendanceAction}
                            disabled={isAttendanceLoading}
                        >
                            {isAttendanceLoading
                                ? <ActivityIndicator color={colors.white} />
                                : (
                                    <>
                                        <Ionicons name={isActive ? 'stop-circle-outline' : 'play-circle-outline'} size={24} color={colors.white} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.attendanceTitle, { color: colors.white }]}>{isActive ? 'Finish Shift' : 'Start Shift'}</Text>
                                            <Text style={styles.attendanceSub}>
                                                {isActive ? `Started at ${new Date(checkInTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Requires Location Access'}
                                            </Text>
                                        </View>
                                    </>
                                )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.error + '1A', borderColor: colors.error + '33' }]} onPress={logout} activeOpacity={0.8}>
                        <Ionicons name="log-out-outline" size={22} color={colors.error} />
                        <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.version, { color: colors.textMuted }]}>ProBloom v1.0.0</Text>
            </ScrollView>

            {/* ═══════ MAP MODAL ═══════ */}
            <Modal visible={showMap} animationType="slide" transparent={false}>
                <View style={mapStyles.container}>
                    <MapView
                        ref={mapRef}
                        style={mapStyles.map}
                        initialRegion={{ latitude: pendingCoords?.latitude || 12.9716, longitude: pendingCoords?.longitude || 77.5946, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                        onPress={e => setPendingCoords(e.nativeEvent.coordinate)}
                    >
                        <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
                        {pendingCoords && <Marker coordinate={pendingCoords} draggable onDragEnd={e => setPendingCoords(e.nativeEvent.coordinate)} />}
                    </MapView>

                    <View style={mapStyles.overlay}>
                        <TouchableOpacity style={mapStyles.closeBtn} onPress={() => setShowMap(false)}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={mapStyles.searchWrapper}>
                            <View style={mapStyles.searchBar}>
                                <Ionicons name="search" size={20} color="#666" />
                                <TextInput style={mapStyles.searchInput} placeholder="Search location..." placeholderTextColor="#666" value={searchQuery} onChangeText={handleSearch} />
                                {searchQuery.length > 0 && <TouchableOpacity onPress={() => handleSearch('')}><Ionicons name="close-circle" size={20} color="#666" /></TouchableOpacity>}
                            </View>
                            {searchResults.length > 0 && (
                                <View style={mapStyles.searchResults}>
                                    <FlatList
                                        data={searchResults}
                                        keyExtractor={(_, i) => i.toString()}
                                        keyboardShouldPersistTaps="handled"
                                        renderItem={({ item }) => (
                                            <TouchableOpacity style={mapStyles.searchResultItem} onPress={() => selectSearchResult(item)}>
                                                <Ionicons name="location" size={16} color={colors.primary} />
                                                <Text style={mapStyles.searchResultText} numberOfLines={2}>{item.display_name}</Text>
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity style={mapStyles.recenterBtn} onPress={handleUpdateLocation}>
                            <Ionicons name="locate" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={mapStyles.footer}>
                        <BlurView intensity={80} tint="dark" style={mapStyles.footerBlur}>
                            <Text style={mapStyles.footerTip}>Drag the pin to your restaurant's exact entrance</Text>
                            <TouchableOpacity style={[mapStyles.confirmBtn, isSaving && { opacity: 0.7 }]} onPress={handleConfirmLocation} disabled={isSaving}>
                                <LinearGradient colors={gradients.primary} style={mapStyles.confirmGradient}>
                                    <Text style={mapStyles.confirmText}>{isSaving ? 'Saving...' : 'Confirm Location'}</Text>
                                    {!isSaving && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                                </LinearGradient>
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: 120 },

    // Profile Card
    profileCard: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadows.sm },
    profileCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
    avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    avatarText: { fontSize: 24, fontWeight: '900' },
    name: { ...Typography.h3, marginBottom: 2 },
    email: { ...Typography.body2, marginBottom: 8 },
    roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1 },
    roleText: { ...Typography.overline, letterSpacing: 1, fontSize: 10 },
    divider: { height: 1, marginVertical: Spacing.md },
    restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    restaurantText: { ...Typography.body2 },

    // Save All
    saveAllBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.xl, ...Shadows.primary },
    saveAllGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10 },
    saveAllText: { ...Typography.button, fontWeight: '700' },

    // Section Header
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: 2, ...Shadows.sm },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionHeaderIcon: { fontSize: 18 },
    sectionHeaderText: { ...Typography.h4, fontWeight: '700' },

    // Section Body
    sectionBody: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm },

    // Setting Row
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    settingInfo: { flex: 1, paddingRight: 12 },
    settingLabel: { ...Typography.body1, fontWeight: '600', marginBottom: 2 },
    settingDesc: { ...Typography.caption, marginTop: 2 },
    settingControl: {},

    // Form Fields
    formField: { marginBottom: 14 },
    fieldLabel: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    fieldInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10, ...Typography.body1 },
    selectBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
    selectOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
    selectMenu: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
    selectOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },

    // Sub Section
    subSection: { borderTopWidth: 1, paddingTop: 16, marginTop: 8 },
    subLabel: { ...Typography.h4, fontWeight: '700', marginBottom: 4 },
    subDesc: { ...Typography.caption, marginBottom: 12 },

    // Custom Printer Row
    customPrinterRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, padding: 12, marginBottom: 8 },
    printerName: { ...Typography.body1, fontWeight: '600' },
    printerIp: { ...Typography.caption, marginTop: 2 },
    removeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // Inline Button
    inlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 12, marginTop: 8 },
    inlineBtnText: { ...Typography.button, fontWeight: '700' },

    // Table Card
    tableCard: { borderWidth: 1, borderRadius: Radius.md, padding: 12, marginBottom: 10 },
    tableCardTitle: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    tableCardRow: { flexDirection: 'row', gap: 12 },
    tableCardInput: { flex: 1 },
    areaTabRow: { flexDirection: 'row', borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
    areaTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    areaTabText: { ...Typography.caption, fontWeight: '600' },

    // Quick Actions
    quickActions: { gap: Spacing.sm, marginTop: Spacing.xl },
    actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
    actionText: { flex: 1, ...Typography.body1, marginLeft: Spacing.md },

    // Attendance
    attendanceBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.sm },
    attendanceTitle: { ...Typography.button, fontWeight: '700' },
    attendanceSub: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

    // Logout
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.sm },
    logoutText: { ...Typography.button, marginLeft: Spacing.sm },

    version: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.xxxl, marginBottom: Spacing.xl },
});

// ─── Map Styles ───────────────────────────────────────────────────────────────
const mapStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { flex: 1 },
    overlay: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    recenterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    searchWrapper: { flex: 1, marginHorizontal: 8 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    searchInput: { flex: 1, marginLeft: 8, color: '#333', fontSize: 14, padding: 0 },
    searchResults: { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, maxHeight: 250, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8, overflow: 'hidden' },
    searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    searchResultText: { flex: 1, marginLeft: 10, fontSize: 13, color: '#444' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    footerBlur: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    footerTip: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 16 },
    confirmBtn: { borderRadius: 16, overflow: 'hidden' },
    confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
