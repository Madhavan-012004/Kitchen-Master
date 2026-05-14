import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
import { useAppTheme, Typography, Spacing, Radius } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProductionScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [menuRes, histRes] = await Promise.all([
                apiClient.get('/menu'),
                apiClient.get('/production/history')
            ]);
            setMenuItems(menuRes.data.data || []);
            setHistory(histRes.data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewRun = () => {
        // Simple alert for now
        Alert.alert('Production', 'Use the Web Dashboard for detailed production runs right now.');
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Production Batches</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <TouchableOpacity onPress={handleNewRun}>
                        <LinearGradient colors={gradients.primary} style={styles.newBtn}>
                            <Ionicons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.newBtnText}>Start New Production</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent History</Text>
                    {history.length === 0 ? (
                        <Text style={{ color: colors.textMuted }}>No production history found.</Text>
                    ) : (
                        history.map((batch, index) => (
                            <View key={index} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.cardTop}>
                                    <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                                        {batch.menuItem?.name || 'Unknown'}
                                    </Text>
                                    <Text style={[styles.qty, { color: colors.primary }]}>+{batch.quantityProduced}</Text>
                                </View>
                                <View style={styles.cardBottom}>
                                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                                        {new Date(batch.createdAt).toLocaleString()}
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>
                                        Cost: ₹{batch.materialCost?.toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
        borderBottomWidth: 1
    },
    backBtn: { marginRight: Spacing.md },
    title: { ...Typography.h3, fontWeight: 'bold' },
    content: { padding: Spacing.lg },
    newBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 16, borderRadius: Radius.md, marginBottom: Spacing.xl, gap: 8
    },
    newBtnText: { color: '#fff', ...Typography.button, fontWeight: 'bold' },
    sectionTitle: { ...Typography.h5, fontWeight: 'bold', marginBottom: Spacing.md },
    card: {
        padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.md
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    itemName: { ...Typography.body1, fontWeight: 'bold' },
    qty: { ...Typography.h5, fontWeight: 'bold' },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
