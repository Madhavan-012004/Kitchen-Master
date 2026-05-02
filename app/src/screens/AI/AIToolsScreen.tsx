import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, ActivityIndicator, Animated,
    Modal, TextInput, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { aiAPI } from '../../api/analytics';
import { useMenuStore } from '../../store/useMenuStore';
import { useCartStore } from '../../store/useCartStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

type ToolConfig = {
    id: string;
    title: string;
    desc: string;
    icon: string;
    iconBg: readonly [string, string, ...string[]];
    cta: string;
    ctaGrad: readonly [string, string, ...string[]];
    tag?: string;
    status?: 'live';
};

export default function AIToolsScreen() {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
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

    const TOOLS: ToolConfig[] = [
        {
            id: 'digitize',
            title: 'Menu Digitizer',
            desc: 'Snap or upload a photo of your physical menu. Gemini AI will extract all items, categories, and prices — no manual typing needed.',
            icon: 'camera',
            iconBg: gradients.primary,
            cta: 'Scan Menu Image',
            ctaGrad: gradients.primary,
        },
        {
            id: 'voice',
            title: 'Voice-to-KOT',
            desc: 'Let waiters dictate orders hands-free. "Two cappuccinos and one croissant for table 12" becomes an instant kitchen order ticket.',
            icon: 'mic',
            iconBg: [colors.accentBlue || '#4C8EFF', colors.accentBlue || '#2563EB'],
            cta: 'Start Beta Trial',
            ctaGrad: [colors.accentBlue || '#4C8EFF', colors.accentBlue || '#2563EB'],
            tag: 'BETA',
        },
        {
            id: 'upsell',
            title: 'Smart Upsell Engine',
            desc: 'Analyzes your sales history to suggest high-converting item combinations inside the POS cart. Boost average bill value effortlessly.',
            icon: 'trending-up',
            iconBg: [colors.success || '#00D68F', colors.success || '#00B377'],
            cta: 'View Suggestions',
            ctaGrad: [colors.success || '#00D68F', colors.success || '#00B377'],
            status: 'live',
        },
    ];

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
            Alert.alert('AI Connection Error', errorMsg);
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
            Alert.alert('AI Error', 'Could not parse this order. Try being more specific.');
        } finally { setLoading(null); }
    };

    const handleVoiceConfirm = () => {
        if (!parsedOrder) return;

        const cartItems = parsedOrder.items.map((item: any) => ({
            menuItemId: item.menuItemId || 'temp-' + Date.now(),
            name: item.name,
            price: item.price || 0,
            quantity: item.quantity || 1,
            taxRate: 18, // Default GST
            category: 'Voice Input',
            notes: item.notes || ''
        }));

        addBulkItems(cartItems);
        Alert.alert('🛒 Order Added!', `Added ${cartItems.length} items to the current cart.`);
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
            Alert.alert('Smart Upsell Active', 'The AI Upsell Engine is now integrated into your POS Checkout flow!');
        }
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <ScrollView contentContainerStyle={themedStyles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Hero Header */}
                    <View style={themedStyles.heroCard}>
                        <LinearGradient
                            colors={[colors.primary + '26', (colors.accentBlue || '#4C8EFF') + '14', 'transparent']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        />
                        <Animated.View style={[themedStyles.sparkle, {
                            opacity: sparkleAnim,
                            transform: [{ scale: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }],
                        }]}>
                            <Ionicons name="sparkles" size={28} color={colors.warning} />
                        </Animated.View>
                        <Text style={themedStyles.heroTitle}>AI Toolkit</Text>
                        <Text style={themedStyles.heroPowered}>Powered by</Text>
                        <View style={themedStyles.geminiChip}>
                            <Ionicons name="logo-google" size={14} color={colors.accentBlue || '#4C8EFF'} />
                            <Text style={themedStyles.geminiText}>Gemini AI</Text>
                        </View>
                        <Text style={themedStyles.heroDesc}>
                            Advanced AI tools to supercharge your restaurant operations.
                        </Text>
                    </View>

                    {/* Tool Cards */}
                    {TOOLS.map((tool) => (
                        <View key={tool.id} style={themedStyles.toolCard}>
                            <LinearGradient
                                colors={[colors.glass, 'transparent']}
                                style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
                            />

                            {/* Tags */}
                            <View style={themedStyles.cardTopRow}>
                                <LinearGradient colors={tool.iconBg} style={themedStyles.iconBg}>
                                    <Ionicons name={tool.icon as any} size={26} color={colors.white} />
                                </LinearGradient>
                                <View style={themedStyles.tagsRow}>
                                    {tool.tag && (
                                        <View style={themedStyles.betaChip}>
                                            <Text style={themedStyles.betaText}>{tool.tag}</Text>
                                        </View>
                                    )}
                                    {tool.status === 'live' && (
                                        <View style={themedStyles.liveChip}>
                                            <View style={themedStyles.liveDot} />
                                            <Text style={themedStyles.liveText}>LIVE</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <Text style={themedStyles.toolTitle}>{tool.title}</Text>
                            <Text style={themedStyles.toolDesc}>{tool.desc}</Text>

                            <TouchableOpacity
                                style={themedStyles.ctaBtn}
                                onPress={() => handleAction(tool.id)}
                                disabled={loading === tool.id}
                                activeOpacity={0.85}
                            >
                                <LinearGradient colors={tool.ctaGrad} style={themedStyles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    {loading === tool.id ? (
                                        <ActivityIndicator color={colors.white} size="small" />
                                    ) : (
                                        <>
                                            <Text style={themedStyles.ctaText}>{tool.cta}</Text>
                                            <Ionicons name="arrow-forward" size={16} color={colors.white} />
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
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={themedStyles.modalOverlay}>
                    <View style={themedStyles.modalContent}>
                        <View style={themedStyles.modalHeader}>
                            <View style={themedStyles.modalTitleRow}>
                                <Ionicons name="mic" size={20} color={colors.primary} />
                                <Text style={themedStyles.modalTitle}>Voice-to-KOT</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setVoiceModalVisible(false); setVoiceText(''); setParsedOrder(null); }}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={themedStyles.modalSubtitle}>
                            Dictate or type the order. Gemini will parse it into items.
                        </Text>

                        <TextInput
                            style={themedStyles.modalInput}
                            placeholder='e.g. "Two chicken biryanis and one coke for table 4"'
                            placeholderTextColor={colors.textMuted}
                            value={voiceText}
                            onChangeText={setVoiceText}
                            multiline
                            numberOfLines={3}
                        />

                        {loading === 'voice' ? (
                            <View style={themedStyles.voiceLoading}>
                                <ActivityIndicator color={colors.primary} size="large" />
                                <Text style={themedStyles.loadingText}>Gemini is parsing your order...</Text>
                            </View>
                        ) : parsedOrder ? (
                            <View style={themedStyles.resultContainer}>
                                <View style={themedStyles.resultHeader}>
                                    <Text style={themedStyles.resultTitle}>Parsed Order Preview</Text>
                                    <View style={themedStyles.tableChip}>
                                        <Text style={themedStyles.tableChipText}>Table {parsedOrder.tableNumber}</Text>
                                    </View>
                                </View>
                                <ScrollView style={themedStyles.itemsList}>
                                    {parsedOrder.items.map((item: any, idx: number) => (
                                        <View key={idx} style={themedStyles.parsedItem}>
                                            <Text style={themedStyles.parsedQty}>{item.quantity}x</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={themedStyles.parsedName}>{item.name}</Text>
                                                {item.notes ? <Text style={themedStyles.parsedNotes}>"{item.notes}"</Text> : null}
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity style={themedStyles.confirmBtn} onPress={handleVoiceConfirm}>
                                    <LinearGradient colors={gradients.primary} style={themedStyles.confirmGradient}>
                                        <Text style={themedStyles.confirmBtnText}>Add to Cart</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[themedStyles.parseBtn, !voiceText.trim() && { opacity: 0.5 }]}
                                onPress={handleParseVoice}
                                disabled={!voiceText.trim()}
                            >
                                <LinearGradient colors={gradients.primary} style={themedStyles.parseGradient}>
                                    <Text style={themedStyles.parseBtnText}>Process Order</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Digitizer Review Modal */}
            <Modal visible={digitizeModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={themedStyles.modalOverlay}>
                    <View style={[themedStyles.modalContent, { height: '80%' }]}>
                        <View style={themedStyles.modalHeader}>
                            <View style={themedStyles.modalTitleRow}>
                                <Ionicons name="receipt-outline" size={24} color={colors.primary} />
                                <Text style={themedStyles.modalTitle}>Review Digitized Menu</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDigitizeModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={themedStyles.modalSubtitle}>Verify or search the {digitizedItems.length} items Gemini found.</Text>

                        {/* Search Bar for Digitized Results */}
                        <View style={themedStyles.searchContainer}>
                            <Ionicons name="search" size={18} color={colors.textMuted} style={themedStyles.searchIcon} />
                            <TextInput
                                style={themedStyles.searchInput}
                                placeholder="Search items or categories..."
                                placeholderTextColor={colors.textMuted}
                                value={digitizeSearch}
                                onChangeText={setDigitizeSearch}
                            />
                            {digitizeSearch !== '' && (
                                <TouchableOpacity onPress={() => setDigitizeSearch('')}>
                                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={themedStyles.digitizedList} showsVerticalScrollIndicator={false}>
                            {filteredDigitizedItems.map((item, idx) => (
                                <View key={idx} style={themedStyles.digitizedItem}>
                                    <View style={[themedStyles.vegDotSmall, { borderColor: item.isVeg ? colors.success || '#00D68F' : colors.error }]}>
                                        <View style={[themedStyles.vegDotInnerSmall, { backgroundColor: item.isVeg ? colors.success || '#00D68F' : colors.error }]} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={themedStyles.itemNameSmall}>{item.name}</Text>
                                        <Text style={themedStyles.itemCategorySmall}>{item.category}</Text>
                                    </View>
                                    <Text style={themedStyles.itemPriceSmall}>₹{item.price}</Text>
                                </View>
                            ))}
                            {filteredDigitizedItems.length === 0 && (
                                <View style={themedStyles.emptySearch}>
                                    <Text style={themedStyles.emptySearchText}>No items match "{digitizeSearch}"</Text>
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={themedStyles.confirmBtn}
                            onPress={handleImportDigitized}
                            disabled={loading === 'digitize'}
                        >
                            <LinearGradient colors={gradients.primary} style={themedStyles.confirmGradient}>
                                {loading === 'digitize' ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <Text style={themedStyles.confirmBtnText}>Import {digitizedItems.length} Items</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, paddingBottom: 130 },
    heroCard: {
        borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xl,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.card, overflow: 'hidden', gap: 6,
    },
    sparkle: { marginBottom: 4 },
    heroTitle: { ...Typography.h2, color: colors.textPrimary },
    heroPowered: { ...Typography.caption, color: colors.textMuted },
    geminiChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: (colors.accentBlue || '#4C8EFF') + '1A', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.accentBlue || '#4C8EFF') + '33',
    },
    geminiText: { ...Typography.caption, color: colors.accentBlue || '#4C8EFF', fontWeight: '700' },
    heroDesc: { ...Typography.body2, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
    toolCard: {
        borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
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
        backgroundColor: (colors.warning || '#FFCA28') + '1A', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.warning || '#FFCA28') + '33',
    },
    betaText: { ...Typography.overline, color: colors.warning || '#FFD700', fontSize: 9 },
    liveChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: (colors.success || '#00D68F') + '1A', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.success || '#00D68F') + '33',
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success || '#00D68F' },
    liveText: { ...Typography.overline, color: colors.success || '#00D68F', fontSize: 9 },
    toolTitle: { ...Typography.h4, color: colors.textPrimary, marginBottom: 8 },
    toolDesc: { ...Typography.body2, color: colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
    ctaBtn: { borderRadius: Radius.md, overflow: 'hidden' },
    ctaGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, gap: 10,
    },
    ctaText: { ...Typography.button, color: colors.white },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        padding: Spacing.xl, minHeight: 400, borderTopWidth: 1, borderTopColor: colors.border,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    modalTitle: { ...Typography.h3, color: colors.textPrimary },
    modalSubtitle: { ...Typography.body2, color: colors.textSecondary, marginBottom: Spacing.lg },
    modalInput: {
        backgroundColor: colors.glass, borderRadius: Radius.lg, padding: Spacing.md,
        color: colors.textPrimary, ...Typography.body1, borderWidth: 1, borderColor: colors.border,
        minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.lg,
    },
    parseBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.md },
    parseGradient: { paddingVertical: 16, alignItems: 'center' },
    parseBtnText: { ...Typography.button, color: colors.white },
    voiceLoading: { padding: Spacing.xl, alignItems: 'center', gap: 12 },
    loadingText: { ...Typography.body2, color: colors.primary, fontWeight: '600' },
    resultContainer: { flex: 1, gap: 12 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultTitle: { ...Typography.h5, color: colors.textPrimary },
    tableChip: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.round },
    tableChipText: { ...Typography.caption, color: colors.white, fontWeight: '700' },
    itemsList: { maxHeight: 200 },
    parsedItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    parsedQty: { ...Typography.h4, color: colors.primary, width: 30 },
    parsedName: { ...Typography.body1, color: colors.textPrimary },
    parsedNotes: { ...Typography.caption, color: colors.warning, fontStyle: 'italic' },
    confirmBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.md },
    confirmGradient: { paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { ...Typography.button, color: colors.white },

    // Digitizer Specific Styles
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass,
        borderRadius: Radius.md, paddingHorizontal: 12, marginBottom: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, height: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: colors.textPrimary, ...Typography.body2 },
    digitizedList: { flex: 1, marginBottom: Spacing.md },
    digitizedItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    vegDotSmall: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.2, justifyContent: 'center', alignItems: 'center' },
    vegDotInnerSmall: { width: 5, height: 5, borderRadius: 1.5 },
    itemNameSmall: { ...Typography.body1, color: colors.textPrimary, fontWeight: '600' },
    itemCategorySmall: { ...Typography.caption, color: colors.textMuted },
    itemPriceSmall: { ...Typography.body1, color: colors.primary, fontWeight: '700' },
    emptySearch: { paddingVertical: 20, alignItems: 'center' },
    emptySearchText: { ...Typography.body2, color: colors.textMuted, fontStyle: 'italic' },
});
