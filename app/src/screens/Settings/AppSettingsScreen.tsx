import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function AppSettingsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true); // App is forced dark right now, but good for UI
    const [sound, setSound] = useState(true);

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>App Settings</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preferences</Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>Push Notifications</Text>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: Colors.border, true: Colors.primary }}
                                thumbColor={Colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="moon-outline" size={22} color={Colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>Dark Mode</Text>
                            </View>
                            <Switch
                                value={darkMode}
                                onValueChange={setDarkMode}
                                trackColor={{ false: Colors.border, true: Colors.primary }}
                                thumbColor={Colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="volume-medium-outline" size={22} color={Colors.textPrimary} style={styles.settingIcon} />
                                <Text style={styles.settingText}>App Sounds & Alerts</Text>
                            </View>
                            <Switch
                                value={sound}
                                onValueChange={setSound}
                                trackColor={{ false: Colors.border, true: Colors.primary }}
                                thumbColor={Colors.white}
                            />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account</Text>

                        <TouchableOpacity style={styles.actionRow}>
                            <Text style={styles.actionText}>Change Password</Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.actionRow}>
                            <Text style={[styles.actionText, { color: Colors.error }]}>Delete Account</Text>
                        </TouchableOpacity>
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
    section: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.glassBorder, marginBottom: Spacing.xl, ...Shadows.sm
    },
    sectionTitle: { ...Typography.body1, color: Colors.textMuted, marginBottom: Spacing.lg },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    settingInfo: { flexDirection: 'row', alignItems: 'center' },
    settingIcon: { marginRight: Spacing.md },
    settingText: { ...Typography.body1, color: Colors.textPrimary },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
    actionText: { ...Typography.body1, color: Colors.textPrimary },
});
