import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    SafeAreaView, Alert, ActivityIndicator, Animated,
    Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { aiAPI } from '../../api/analytics';
import { useMenuStore } from '../../store/useMenuStore';
import { useCartStore } from '../../store/useCartStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

type ToolConfig = {
    id: string;
    title: string;
    desc: string;
    icon: string;
    iconBg: readonly [string, string];
    cta: string;
    ctaGrad: readonly [string, string];
    tag?: string;
    status?: 'live';
};

const TOOLS: ToolConfig[] = [
    {
        id: 'digitize',
        title: 'Menu Digitizer',
        desc: 'Snap or upload a photo of your physical menu. Gemini AI will extract all items, categories, and prices — no manual typing needed.',
        icon: 'camera',
        iconBg: ['#FF8A5C', '#FF6B35'] as const,
        cta: 'Scan Menu Image',
        ctaGrad: ['#FF8A5C', '#FF6B35'] as const,
    },
    {
        id: 'voice',
        title: 'Voice-to-KOT',
        desc: 'Let waiters dictate orders hands-free. "Two cappuccinos and one croissant for table 12" becomes an instant kitchen order ticket.',
        icon: 'mic',
        iconBg: ['#4C8EFF', '#2563EB'] as const,
        cta: 'Start Beta Trial',
        ctaGrad: ['#4C8EFF', '#2563EB'] as const,
        tag: 'BETA',
    },
    {
        id: 'upsell',
        title: 'Smart Upsell Engine',
        desc: 'Analyzes your sales history to suggest high-converting item combinations inside the POS cart. Boost average bill value effortlessly.',
        icon: 'trending-up',
        iconBg: ['#00D68F', '#00B377'] as const,
        cta: 'View Suggestions',
        ctaGrad: ['#00D68F', '#00B377'] as const,
        status: 'live',
    },
];

export default function AIToolsScreen() {
    const [loading, setLoading] = useState<string | null>(null);
    const { bulkImport } = useMenuStore();
    const { addBulkItems } = useCartStore();
    const sparkleAnim = useRef(new Animated.Value(0)).current;

    // Voice Modal State
    const [voiceModalVisible, setVoiceModalVisible] = useState(false);
    const [voiceText, setVoiceText] = useState('');
    const [parsedOrder, setParsedOrder] = useState<any>(null);

    // Digitizer Review State
    const [digitizeModalVisible, setDigitizeModalVisible] = useState(false);
    const [digitizedItems, setDigitizedItems] = useState<any[]>([]);
    const [digitizeSearch, setDigitizeSearch] = useState('');

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(sparkleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(sparkleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleDigitize = async () => {
        const options = ['Camera', 'Gallery', 'Cancel'];
        Alert.alert('Digitize Menu', 'Select image source', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Camera',
                onPress: async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') return Alert.alert('Error', 'Camera permission required');
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                    if (!result.canceled) processImage(result.assets[0].uri);
                }
            },
            {
                text: 'Gallery',
                onPress: async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                    if (!result.canceled) processImage(result.assets[0].uri);
                }
            }
        ]);
    };

    const processImage = async (uri: string) => {
        // Dynamic extension and mime type detection
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1].toLowerCase();

        let mimeType = 'image/jpeg';
        if (fileType === 'png') mimeType = 'image/png';
        if (fileType === 'webp') mimeType = 'image/webp';
        if (fileType === 'heic') mimeType = 'image/heic';
        if (fileType === 'heif') mimeType = 'image/heif';

        const formData = new FormData();
        formData.append('menuImage', {
            uri,
            name: `menu.${fileType}`,
            type: mimeType,
        } as any);

        setLoading('digitize');
        try {
            const res = await aiAPI.digitizeMenu(formData);
            const items = res.data.data.items;

            if (!items || items.length === 0) {
                throw new Error('No items found in this image.');
            }

            setDigitizedItems(items);
            setDigitizeModalVisible(true);
        } catch (e: any) {
            const errorMsg = e.response?.data?.message || e.message;
            Alert.alert('AI Error', errorMsg || 'Could not process this image.');
        } finally { setLoading(null); }
    };

    const handleImportDigitized = async () => {
        setLoading('digitize');
        try {
            await bulkImport(digitizedItems);
            Alert.alert('✅ Success!', `Successfully imported ${digitizedItems.length} items to your menu.`);
            setDigitizeModalVisible(false);
            setDigitizedItems([]);
            setDigitizeSearch('');
        } catch (e) {
            Alert.alert('Error', 'Failed to import items. Please try again.');
        } finally { setLoading(null); }
    };

    const filteredDigitizedItems = digitizedItems.filter(item =>
        item.name.toLowerCase().includes(digitizeSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(digitizeSearch.toLowerCase())
    );

    const handleParseVoice = async () => {
        if (!voiceText.trim()) return;
        setLoading('voice');
        try {
            const res = await aiAPI.parseVoiceOrder(voiceText);
            setParsedOrder(res.data.data.order);
        } catch (e: any) {
            Alert.alert('AI Error', 'Could not parse this order. Try being more specific (e.g. "2 Coffee for table 5")');
        } finally { setLoading(null); }
    };

    const handleVoiceConfirm = () => {
        if (!parsedOrder) return;

        const cartItems = parsedOrder.items.map((item: any) => ({
            menuItemId: item.menuItemId || 'temp-' + Date.now(),
            name: item.name,
            price: item.price || 0,
            quantity: item.quantity || 1,
            taxRate: 5, // Default
            category: 'Voice Input',
            notes: item.notes || ''
        }));

        addBulkItems(cartItems);
        Alert.alert('🛒 Order Added!', `Successfully added ${cartItems.length} items to the current cart.`);
        setVoiceModalVisible(false);
        setVoiceText('');
        setParsedOrder(null);
    };

    const handleAction = (id: string) => {
        if (id === 'digitize') return handleDigitize();
        if (id === 'voice') {
            setVoiceModalVisible(true);
            return;
        }
        if (id === 'upsell') {
            Alert.alert('Smart Upsell Active', 'The AI Upsell Engine is now integrated into your POS Checkout flow! Simply add items to a cart and view suggestions at checkout.');
        }
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Hero Header */}
                    <View style={styles.heroCard}>
                        <LinearGradient
                            colors={['rgba(76,142,255,0.15)', 'rgba(255,107,53,0.08)', 'transparent']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        />
                        <Animated.View style={[styles.sparkle, {
                            opacity: sparkleAnim,
                            transform: [{ scale: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }],
                        }]}>
                            <Ionicons name="sparkles" size={28} color={Colors.accentYellow} />
                        </Animated.View>
                        <Text style={styles.heroTitle}>AI Toolkit</Text>
                        <Text style={styles.heroPowered}>Powered by</Text>
                        <View style={styles.geminiChip}>
                            <Ionicons name="logo-google" size={14} color={Colors.accentBlue} />
                            <Text style={styles.geminiText}>Gemini AI</Text>
                        </View>
                        <Text style={styles.heroDesc}>
                            Advanced AI tools to supercharge your restaurant operations.
                        </Text>
                    </View>

                    {/* Tool Cards */}
                    {TOOLS.map((tool) => (
                        <View key={tool.id} style={styles.toolCard}>
                            <LinearGradient
                                colors={['rgba(255,255,255,0.04)', 'transparent']}
                                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                            />

                            {/* Tags */}
                            <View style={styles.cardTopRow}>
                                <LinearGradient colors={tool.iconBg} style={styles.iconBg}>
                                    <Ionicons name={tool.icon as any} size={26} color={Colors.white} />
                                </LinearGradient>
                                <View style={styles.tagsRow}>
                                    {tool.tag && (
                                        <View style={styles.betaChip}>
                                            <Text style={styles.betaText}>{tool.tag}</Text>
                                        </View>
                                    )}
                                    {tool.status === 'live' && (
                                        <View style={styles.liveChip}>
                                            <View style={styles.liveDot} />
                                            <Text style={styles.liveText}>LIVE</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <Text style={styles.toolTitle}>{tool.title}</Text>
                            <Text style={styles.toolDesc}>{tool.desc}</Text>

                            <TouchableOpacity
                                style={styles.ctaBtn}
                                onPress={() => handleAction(tool.id)}
                                disabled={loading === tool.id}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={tool.ctaGrad} style={styles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    {loading === tool.id ? (
                                        <ActivityIndicator color={Colors.white} size="small" />
                                    ) : (
                                        <>
                                            <Text style={styles.ctaText}>{tool.cta}</Text>
                                            <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>

            {/* Voice Dictation Modal */}
            <Modal visible={voiceModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Ionicons name="mic" size={20} color={Colors.primary} />
                                <Text style={styles.modalTitle}>Voice-to-KOT</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setVoiceModalVisible(false); setVoiceText(''); setParsedOrder(null); }}>
                                <Ionicons name="close" size={24} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Dictate or type the order. Gemini will parse it into items.
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder='e.g. "Two chicken biryanis and one coke for table 4"'
                            placeholderTextColor={Colors.textMuted}
                            value={voiceText}
                            onChangeText={setVoiceText}
                            multiline
                            numberOfLines={3}
                        />

                        {loading === 'voice' ? (
                            <View style={styles.voiceLoading}>
                                <ActivityIndicator color={Colors.primary} size="large" />
                                <Text style={styles.loadingText}>Gemini is parsing your order...</Text>
                            </View>
                        ) : parsedOrder ? (
                            <View style={styles.resultContainer}>
                                <View style={styles.resultHeader}>
                                    <Text style={styles.resultTitle}>Parsed Order Preview</Text>
                                    <View style={styles.tableChip}>
                                        <Text style={styles.tableChipText}>{parsedOrder.tableNumber}</Text>
                                    </View>
                                </View>
                                <ScrollView style={styles.itemsList}>
                                    {parsedOrder.items.map((item: any, idx: number) => (
                                        <View key={idx} style={styles.parsedItem}>
                                            <Text style={styles.parsedQty}>{item.quantity}x</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.parsedName}>{item.name}</Text>
                                                {item.notes ? <Text style={styles.parsedNotes}>"{item.notes}"</Text> : null}
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity style={styles.confirmBtn} onPress={handleVoiceConfirm}>
                                    <LinearGradient colors={Gradients.primary} style={styles.confirmGradient}>
                                        <Text style={styles.confirmBtnText}>Add to Cart</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.parseBtn, !voiceText.trim() && { opacity: 0.5 }]}
                                onPress={handleParseVoice}
                                disabled={!voiceText.trim()}
                            >
                                <LinearGradient colors={Gradients.primary} style={styles.parseGradient}>
                                    <Text style={styles.parseBtnText}>Process Order</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Digitizer Review Modal */}
            <Modal visible={digitizeModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Ionicons name="receipt-outline" size={24} color={Colors.primary} />
                                <Text style={styles.modalTitle}>Review Digitzed Menu</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDigitizeModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Verify or search the {digitizedItems.length} items Gemini found.</Text>

                        {/* Search Bar for Digitized Results */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search items or categories..."
                                placeholderTextColor={Colors.textMuted}
                                value={digitizeSearch}
                                onChangeText={setDigitizeSearch}
                            />
                            {digitizeSearch !== '' && (
                                <TouchableOpacity onPress={() => setDigitizeSearch('')}>
                                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.digitizedList} showsVerticalScrollIndicator={false}>
                            {filteredDigitizedItems.map((item, idx) => (
                                <View key={idx} style={styles.digitizedItem}>
                                    <View style={[styles.vegDotSmall, { borderColor: item.isVeg ? Colors.accentGreen : Colors.error }]}>
                                        <View style={[styles.vegDotInnerSmall, { backgroundColor: item.isVeg ? Colors.accentGreen : Colors.error }]} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemNameSmall}>{item.name}</Text>
                                        <Text style={styles.itemCategorySmall}>{item.category}</Text>
                                    </View>
                                    <Text style={styles.itemPriceSmall}>₹{item.price}</Text>
                                </View>
                            ))}
                            {filteredDigitizedItems.length === 0 && (
                                <View style={styles.emptySearch}>
                                    <Text style={styles.emptySearchText}>No items match "{digitizeSearch}"</Text>
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={handleImportDigitized}
                            disabled={loading === 'digitize'}
                        >
                            <LinearGradient colors={Gradients.primary} style={styles.confirmGradient}>
                                {loading === 'digitize' ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <Text style={styles.confirmBtnText}>Import {digitizedItems.length} Items</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: Spacing.lg, paddingBottom: 130 },
    heroCard: {
        borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xl,
        alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder,
        backgroundColor: Colors.card, overflow: 'hidden', gap: 6,
    },
    sparkle: { marginBottom: 4 },
    heroTitle: { ...Typography.h2, color: Colors.textPrimary },
    heroPowered: { ...Typography.caption, color: Colors.textMuted },
    geminiChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(76,142,255,0.12)', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(76,142,255,0.3)',
    },
    geminiText: { ...Typography.caption, color: Colors.accentBlue, fontWeight: '700' },
    heroDesc: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
    toolCard: {
        borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg,
        backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
        overflow: 'hidden', ...Shadows.sm,
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
    iconBg: {
        width: 60, height: 60, borderRadius: Radius.lg,
        justifyContent: 'center', alignItems: 'center',
        ...Shadows.sm,
    },
    tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
    betaChip: {
        backgroundColor: 'rgba(255,202,40,0.15)', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(255,202,40,0.5)',
    },
    betaText: { ...Typography.overline, color: Colors.accentYellow, fontSize: 9 },
    liveChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(0,214,143,0.12)', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(0,214,143,0.3)',
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accentGreen },
    liveText: { ...Typography.overline, color: Colors.accentGreen, fontSize: 9 },
    toolTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 8 },
    toolDesc: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
    ctaBtn: { borderRadius: Radius.md, overflow: 'hidden' },
    ctaGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, gap: 10,
    },
    ctaText: { ...Typography.button, color: Colors.white },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        padding: Spacing.xl, minHeight: 400, borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    modalTitle: { ...Typography.h3, color: Colors.textPrimary },
    modalSubtitle: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.lg },
    modalInput: {
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, padding: Spacing.md,
        color: Colors.white, ...Typography.body1, borderWidth: 1, borderColor: Colors.border,
        minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.lg,
    },
    parseBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.md },
    parseGradient: { paddingVertical: 16, alignItems: 'center' },
    parseBtnText: { ...Typography.button, color: Colors.white },
    voiceLoading: { padding: Spacing.xl, alignItems: 'center', gap: 12 },
    loadingText: { ...Typography.body2, color: Colors.primary, fontWeight: '600' },
    resultContainer: { flex: 1, gap: 12 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultTitle: { ...Typography.h5, color: Colors.textPrimary },
    tableChip: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.round },
    tableChipText: { ...Typography.caption, color: Colors.white, fontWeight: '700' },
    itemsList: { maxHeight: 200 },
    parsedItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    parsedQty: { ...Typography.h4, color: Colors.primary, width: 30 },
    parsedName: { ...Typography.body1, color: Colors.textPrimary },
    parsedNotes: { ...Typography.caption, color: Colors.warning, fontStyle: 'italic' },
    confirmBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.md },
    confirmGradient: { paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { ...Typography.button, color: Colors.white },

    // Digitizer Specific Styles
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: Radius.md, paddingHorizontal: 12, marginBottom: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border, height: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: Colors.white, ...Typography.body2 },
    digitizedList: { flex: 1, marginBottom: Spacing.md },
    digitizedItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    vegDotSmall: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' },
    vegDotInnerSmall: { width: 5, height: 5, borderRadius: 1.5 },
    itemNameSmall: { ...Typography.body1, color: Colors.white, fontWeight: '600' },
    itemCategorySmall: { ...Typography.caption, color: Colors.textMuted },
    itemPriceSmall: { ...Typography.body1, color: Colors.primary, fontWeight: '700' },
    emptySearch: { paddingVertical: 20, alignItems: 'center' },
    emptySearchText: { ...Typography.body2, color: Colors.textMuted, fontStyle: 'italic' },
});
