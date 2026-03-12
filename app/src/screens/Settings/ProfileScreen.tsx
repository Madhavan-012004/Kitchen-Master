import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function ProfileScreen({ navigation }: any) {
    const { user, logout, updateProfile, isLoading } = useAuthStore();

    if (!user) return null;

    const handleUpdateLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Please enable location access.' });
                return;
            }

            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            await updateProfile({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            });

            Toast.show({ type: 'success', text1: 'Success', text2: 'Restaurant location updated!' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
        }
    };

    const roleColors: Record<string, string> = {
        owner: Colors.primary,
        manager: Colors.accentBlue,
        waiter: Colors.accentYellow,
        kitchen: Colors.error,
        inventory: Colors.accentPurple,
    };

    const roleColor = roleColors[user.role] || Colors.textSecondary;

    return (
        <View style={styles.container}>
            <LinearGradient colors={Gradients.background} style={StyleSheet.absoluteFillObject} />

            <View style={styles.bgGlow} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                <View style={styles.glassContainer}>
                    <BlurView intensity={25} tint="dark" style={styles.glassBlur}>
                        <View style={styles.profileHeader}>
                            <View style={styles.avatarWrapper}>
                                <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.avatar}>
                                    <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
                                </LinearGradient>
                            </View>
                            <View style={styles.profileInfo}>
                                <Text style={styles.name}>{user.name}</Text>
                                <Text style={styles.email}>{user.email}</Text>
                                <View style={[styles.roleBadge, { borderColor: roleColor, backgroundColor: `${roleColor}15` }]}>
                                    <Text style={[styles.roleText, { color: roleColor }]}>{user.role.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Ionicons name="restaurant-outline" size={20} color={Colors.textSecondary} />
                            <View style={styles.infoCol}>
                                <Text style={styles.infoLabel}>Restaurant</Text>
                                <Text style={styles.infoValue}>{user.restaurantName}</Text>
                            </View>
                        </View>

                        {user.phone && (
                            <View style={styles.infoRow}>
                                <Ionicons name="call-outline" size={20} color={Colors.textSecondary} />
                                <View style={styles.infoCol}>
                                    <Text style={styles.infoLabel}>Phone</Text>
                                    <Text style={styles.infoValue}>{user.phone}</Text>
                                </View>
                            </View>
                        )}
                    </BlurView>
                </View>

                <View style={styles.linksContainer}>
                    {user.role === 'owner' && (
                        <>
                            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('EmployeeManagement')}>
                                <Ionicons name="people-outline" size={22} color={Colors.primary} />
                                <Text style={styles.linkText}>Manage Staff & Roles</Text>
                                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.linkRow, { backgroundColor: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }]}
                                onPress={handleUpdateLocation}
                                disabled={isLoading}
                            >
                                <Ionicons name="location-outline" size={22} color="#22c55e" />
                                <Text style={[styles.linkText, { color: '#22c55e' }]}>
                                    {isLoading ? 'Updating Location...' : 'Set Restaurant Location'}
                                </Text>
                                <Ionicons name="sync-outline" size={18} color="#22c55e" />
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('AppSettings')}>
                        <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
                        <Text style={styles.linkText}>App Settings</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('HelpSupport')}>
                        <Ionicons name="help-buoy-outline" size={22} color={Colors.textPrimary} />
                        <Text style={styles.linkText}>Help & Support</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
                        <Ionicons name="log-out-outline" size={22} color={Colors.error} />
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.version}>Kitchen Master v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050A' },
    bgGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,107,53,0.08)', top: -100, right: -100 },
    scrollContent: { flexGrow: 1, padding: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 140 },
    header: { marginBottom: Spacing.xxl },
    headerTitle: { ...Typography.h1, color: Colors.textPrimary },
    glassContainer: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.glassBorder, backgroundColor: 'rgba(20,22,35,0.4)', ...Shadows.lg, marginBottom: Spacing.xxl },
    glassBlur: { padding: Spacing.xxl },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
    avatarWrapper: { marginRight: Spacing.lg },
    avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    avatarText: { ...Typography.h2, color: Colors.white },
    profileInfo: { flex: 1, justifyContent: 'center' },
    name: { ...Typography.h3, color: Colors.white, marginBottom: 2 },
    email: { ...Typography.body2, color: Colors.textSecondary, marginBottom: 8 },
    roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1 },
    roleText: { ...Typography.overline, letterSpacing: 1 },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xl },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
    infoCol: { marginLeft: Spacing.md },
    infoLabel: { ...Typography.caption, color: Colors.textMuted },
    infoValue: { ...Typography.body1, color: Colors.textPrimary, marginTop: 2 },
    linksContainer: { gap: Spacing.md },
    linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.glass, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
    linkText: { flex: 1, ...Typography.body1, color: Colors.textPrimary, marginLeft: Spacing.md },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,92,124,0.1)', padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,92,124,0.3)', marginTop: Spacing.lg },
    logoutText: { ...Typography.button, color: Colors.error, marginLeft: Spacing.sm },
    version: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxxl },
});
