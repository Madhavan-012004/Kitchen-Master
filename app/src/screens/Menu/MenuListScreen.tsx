import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useMenuStore } from '../../store/useMenuStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

const CATEGORY_COLORS: Record<string, readonly [string, string]> = {
    Beverages: ['#4C8EFF', '#2563EB'],
    Starters: ['#FF8A5C', '#FF6B35'],
    Mains: ['#9B59B6', '#6C3483'],
    Desserts: ['#FFD700', '#F59E0B'],
    Breads: ['#CD7F32', '#A16207'],
};

function getCategoryColor(cat: string): readonly [string, string] {
    return CATEGORY_COLORS[cat] || ['#4A5580', '#2D3748'];
}

export default function MenuListScreen({ navigation }: any) {
    const { items, isLoading, fetchMenu, toggleItem, deleteItem } = useMenuStore();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { fetchMenu(); }, []);

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: any) => {
        const catColors = getCategoryColor(item.category);
        const isAvailable = item.isAvailable;

        const handleToggle = async () => {
            try {
                await toggleItem(item._id);
                Toast.show({
                    type: 'success',
                    text1: 'Update Successful',
                    text2: `${item.name} is now ${!isAvailable ? 'Available' : 'Out of Stock'}`
                });
            } catch (e) {
                Toast.show({
                    type: 'error',
                    text1: 'Update Failed',
                    text2: 'Please check your connection'
                });
            }
        };

        return (
            <View style={styles.card}>
                <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />

                <View style={styles.cardMain}>
                    {/* Category color square */}
                    <LinearGradient colors={catColors} style={styles.thumb}>
                        <Ionicons name="restaurant" size={20} color="rgba(255,255,255,0.9)" />
                    </LinearGradient>

                    <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                            <View style={[styles.vegDot, { borderColor: item.isVeg ? Colors.accentGreen : Colors.error }]}>
                                <View style={[styles.vegDotInner, { backgroundColor: item.isVeg ? Colors.accentGreen : Colors.error }]} />
                            </View>
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        </View>

                        <View style={styles.metaRow}>
                            <View style={[styles.categoryChip, { borderColor: catColors[0] + '60' }]}>
                                <Text style={[styles.categoryText, { color: catColors[0] }]}>{item.category}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.price}>₹{item.price}</Text>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={[styles.availBtn, { backgroundColor: isAvailable ? 'rgba(0,214,143,0.1)' : 'rgba(255,92,124,0.1)', borderColor: isAvailable ? 'rgba(0,214,143,0.3)' : 'rgba(255,92,124,0.3)' }]}
                        onPress={handleToggle}
                    >
                        <Ionicons name={isAvailable ? 'eye-outline' : 'eye-off-outline'} size={14} color={isAvailable ? Colors.accentGreen : Colors.error} />
                        <Text style={[styles.availText, { color: isAvailable ? Colors.accentGreen : Colors.error }]}>
                            {isAvailable ? 'Available' : 'Sold Out'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.iconActions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('EditMenuItem', { item })}>
                            <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(255,92,124,0.08)', borderColor: 'rgba(255,92,124,0.2)' }]} onPress={() => deleteItem(item._id)}>
                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Menu</Text>
                        <Text style={styles.headerSub}>
                            {searchQuery ? `${filteredItems.length} found` : `${items.length} items`}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('EditMenuItem')} activeOpacity={0.85}>
                        <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.addBtnGrad}>
                            <Ionicons name="add" size={22} color={Colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search dishes or categories..."
                        placeholderTextColor={Colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {isLoading && items.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredItems}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="journal-outline" size={42} color={Colors.textMuted} />
                                </View>
                                <Text style={styles.emptyTitle}>
                                    {searchQuery ? 'No matches found' : 'No menu items yet'}
                                </Text>
                                <Text style={styles.emptyText}>
                                    {searchQuery ? `Try searching for something else` : 'Add your first item to get started'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    headerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.md,
        paddingHorizontal: 12, marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        borderWidth: 1, borderColor: Colors.border, height: 46,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: Colors.white, ...Typography.body2 },
    addBtn: { borderRadius: Radius.md, overflow: 'hidden', ...Shadows.primary },
    addBtnGrad: { width: 44, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: 130 },
    card: {
        borderRadius: Radius.lg, marginBottom: Spacing.md, overflow: 'hidden',
        backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
    },
    cardMain: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
    thumb: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
    vegDot: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    vegDotInner: { width: 6, height: 6, borderRadius: 2 },
    itemName: { ...Typography.h5, color: Colors.textPrimary, flex: 1 },
    metaRow: { flexDirection: 'row' },
    categoryChip: {
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.round,
        borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    },
    categoryText: { ...Typography.overline, fontSize: 9 },
    price: { ...Typography.h4, color: Colors.primary },
    cardActions: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderTopWidth: 1, borderTopColor: Colors.border,
    },
    availBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.round, borderWidth: 1,
    },
    availText: { fontSize: 12, fontWeight: '700' },
    iconActions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.glass,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    },
    emptyTitle: { ...Typography.h4, color: Colors.textSecondary },
    emptyText: { ...Typography.body2, color: Colors.textMuted },
});
