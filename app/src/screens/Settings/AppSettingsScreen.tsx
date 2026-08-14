import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import LanguageSwitch from '../../components/LanguageSwitch';
import { useAuthStore } from '../../store/useAuthStore';

export default function AppSettingsScreen({ navigation }: any) {
    const { theme, toggleTheme, isDark, colors, gradients } = useAppTheme();
    const styles = React.useMemo(() => createStyles(colors, gradients), [colors, gradients]);

    const { t, i18n } = useTranslation();
    const { user, updateProfile } = useAuthStore();
    const [notifications, setNotifications] = useState(true);
    const [sound, setSound] = useState(true);
    const [updatingLayout, setUpdatingLayout] = useState(false);

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ta' : 'en';
        i18n.changeLanguage(newLang);
    };

    const currentMode = user?.preferredPosMode || 'restaurant';

    const handleLayoutChange = async (mode: string) => {
        if (!user || currentMode === mode) return;
        setUpdatingLayout(true);
        try {
            await updateProfile({ preferredPosMode: mode });
        } catch (e) {
            console.error('Failed to update layout', e);
        } finally {
            setUpdatingLayout(false);
        }
    };

    return (
        <LinearGradient colors={gradients.background} style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('app.settings', 'App Settings')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('app.preferences', 'Preferences')}</Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>Push Notifications</Text>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        {user?.role === 'owner' && (
                            <>
                                <View style={styles.layoutSection}>
                                    <View style={styles.settingInfo}>
                                        <Ionicons name="storefront-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                                        <Text style={styles.settingText}>Store Type (POS Layout)</Text>
                                    </View>
                                    <View style={styles.layoutOptions}>
                                        <TouchableOpacity
                                            style={[styles.layoutBtn, currentMode === 'restaurant' && styles.layoutBtnActive]}
                                            onPress={() => handleLayoutChange('restaurant')}
                                            disabled={updatingLayout}
                                        >
                                            <Text style={[styles.layoutBtnText, currentMode === 'restaurant' && styles.layoutBtnTextActive]}>Restaurant</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.layoutBtn, currentMode === 'supermarket' && styles.layoutBtnActive]}
                                            onPress={() => handleLayoutChange('supermarket')}
                                            disabled={updatingLayout}
                                        >
                                            <Text style={[styles.layoutBtnText, currentMode === 'supermarket' && styles.layoutBtnTextActive]}>Market</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.layoutBtn, currentMode === 'clothing' && styles.layoutBtnActive]}
                                            onPress={() => handleLayoutChange('clothing')}
                                            disabled={updatingLayout}
                                        >
                                            <Text style={[styles.layoutBtnText, currentMode === 'clothing' && styles.layoutBtnTextActive]}>Clothing</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.layoutBtn, currentMode === 'poultry' && styles.layoutBtnActive]}
                                            onPress={() => handleLayoutChange('poultry')}
                                            disabled={updatingLayout}
                                        >
                                            <Text style={[styles.layoutBtnText, currentMode === 'poultry' && styles.layoutBtnTextActive]}>Poultry</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.divider} />
                            </>
                        )}

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="moon-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>Dark Mode</Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="volume-medium-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>App Sounds & Alerts</Text>
                            </View>
                            <Switch
                                value={sound}
                                onValueChange={setSound}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="language-outline" size={22} color={colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>{t('app.language', 'Language')} ({i18n.language === 'en' ? 'EN' : 'தமிழ்'})</Text>
                            </View>
                            <LanguageSwitch isTamil={i18n.language === 'ta'} onToggle={toggleLanguage} />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account</Text>

                        <TouchableOpacity style={styles.actionRow}>
                            <Text style={styles.actionText}>Change Password</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.actionRow}>
                            <Text style={[styles.actionText, { color: colors.error }]}>Delete Account</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    content: { padding: Spacing.lg },
    section: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.xl, ...Shadows.sm
    },
    sectionTitle: { ...Typography.body1, color: colors.textMuted, marginBottom: Spacing.lg },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    settingInfo: { flexDirection: 'row', alignItems: 'center' },
    settingIcon: { marginRight: Spacing.md },
    settingText: { ...Typography.body1, color: colors.textPrimary },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.md },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    actionText: { ...Typography.body1, color: colors.textPrimary },
    layoutSection: { paddingVertical: Spacing.sm },
    layoutOptions: { flexDirection: 'row', marginTop: Spacing.md, gap: 8, flexWrap: 'wrap' },
    layoutBtn: { width: '48%', marginBottom: 4, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    layoutBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    layoutBtnText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    layoutBtnTextActive: { color: '#000000', fontWeight: '800' },
});
