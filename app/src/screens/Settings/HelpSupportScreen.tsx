import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function HelpSupportScreen({ navigation }: any) {
    const handleEmail = () => {
        Linking.openURL('mailto:support@kitchenmaster.com?subject=App Support Request');
    };

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Help & Support</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>

                    <View style={styles.contactCard}>
                        <LinearGradient colors={['rgba(255,107,53,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
                        <Ionicons name="chatbubbles-outline" size={48} color={Colors.primary} style={{ marginBottom: Spacing.md }} />
                        <Text style={styles.cardTitle}>Need Help?</Text>
                        <Text style={styles.cardDesc}>Our support team is always ready to assist you with any issues.</Text>

                        <TouchableOpacity style={styles.contactBtn} onPress={handleEmail}>
                            <Ionicons name="mail-outline" size={20} color={Colors.white} />
                            <Text style={styles.contactBtnText}>Email Support</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQ}>How do I add a new menu item?</Text>
                        <Text style={styles.faqA}>Go to the Menu tab, and click the "+" icon at the top right to digitize a menu or manually create an item.</Text>
                    </View>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQ}>Can my waiters use this app?</Text>
                        <Text style={styles.faqA}>Yes! As an owner, go to Profile -{'>'} Manage Staff & Roles to create accounts for your team. They can log in immediately.</Text>
                    </View>

                    <View style={styles.faqItem}>
                        <Text style={styles.faqQ}>How does offline mode work?</Text>
                        <Text style={styles.faqA}>Orders taken in the POS while offline are stored locally. They automatically sync to the cloud when internet is restored.</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
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
    content: { padding: Spacing.lg },
    contactCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
        alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: Spacing.xxl, ...Shadows.md, overflow: 'hidden'
    },
    cardTitle: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
    cardDesc: { ...Typography.body2, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
    contactBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.round, gap: 8
    },
    contactBtnText: { ...Typography.button, color: Colors.white },
    faqTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.lg },
    faqItem: {
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: Radius.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md
    },
    faqQ: { ...Typography.body1, color: Colors.white, marginBottom: Spacing.xs },
    faqA: { ...Typography.body2, color: Colors.textMuted, lineHeight: 22 },
});
