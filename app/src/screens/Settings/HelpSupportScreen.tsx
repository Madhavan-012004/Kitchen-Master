import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

export default function HelpSupportScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    const handleEmail = () => {
        Linking.openURL('mailto:support@ProBloom.com?subject=App Support Request');
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                <View style={themedStyles.header}>
                    <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={themedStyles.headerTitle}>Help & Support</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={themedStyles.content}>

                    <View style={themedStyles.contactCard}>
                        <LinearGradient colors={[colors.primary + '1A', 'transparent']} style={StyleSheet.absoluteFill} />
                        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} style={{ marginBottom: Spacing.md }} />
                        <Text style={themedStyles.cardTitle}>Need Help?</Text>
                        <Text style={themedStyles.cardDesc}>Our support team is always ready to assist you with any issues or feedback.</Text>

                        <TouchableOpacity style={themedStyles.contactBtn} onPress={handleEmail} activeOpacity={0.8}>
                            <Ionicons name="mail-outline" size={20} color={colors.white} />
                            <Text style={themedStyles.contactBtnText}>Email Support</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={themedStyles.faqTitle}>Frequently Asked Questions</Text>

                    <View style={themedStyles.faqItem}>
                        <Text style={themedStyles.faqQ}>How do I add a new menu item?</Text>
                        <Text style={themedStyles.faqA}>Go to the Menu tab, and click the "+" icon at the top right to create a new item or scan a physical menu.</Text>
                    </View>

                    <View style={themedStyles.faqItem}>
                        <Text style={themedStyles.faqQ}>Can my waiters use this app?</Text>
                        <Text style={themedStyles.faqA}>Yes! As an owner, go to Profile -{'>'} Manage Staff & Roles to create accounts for your team.</Text>
                    </View>

                    <View style={themedStyles.faqItem}>
                        <Text style={themedStyles.faqQ}>How does offline mode work?</Text>
                        <Text style={themedStyles.faqA}>Orders taken in the POS while offline are stored locally and automatically sync when internet is restored.</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    content: { padding: Spacing.lg },
    contactCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.xxl, ...Shadows.md, overflow: 'hidden'
    },
    cardTitle: { ...Typography.h3, color: colors.textPrimary, marginBottom: Spacing.sm },
    cardDesc: { ...Typography.body2, color: colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg, paddingHorizontal: Spacing.md },
    contactBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.round, gap: 8
    },
    contactBtnText: { ...Typography.button, color: colors.white },
    faqTitle: { ...Typography.h4, color: colors.textPrimary, marginBottom: Spacing.lg },
    faqItem: {
        backgroundColor: colors.glass, borderRadius: Radius.lg, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md
    },
    faqQ: { ...Typography.body1, color: colors.textPrimary, marginBottom: Spacing.xs, fontWeight: '700' },
    faqA: { ...Typography.body2, color: colors.textSecondary, lineHeight: 22 },
});
