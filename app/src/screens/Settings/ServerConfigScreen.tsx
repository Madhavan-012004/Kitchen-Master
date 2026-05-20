import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
    Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveServerUrl, testServerConnection, getServerBaseUrl, resetServerUrl } from '../../config/api';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/useAuthStore';

type Status = 'idle' | 'testing' | 'success' | 'error';

export default function ServerConfigScreen({ navigation }: any) {
    const { user } = useAuthStore();
    const { colors, gradients, isDark } = useAppTheme();

    useEffect(() => {
        if (user?.role === 'waiter') {
            navigation.goBack();
        }
    }, [user, navigation]);

    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState('');

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Load saved URL on mount
        getServerBaseUrl().then((saved) => {
            if (saved && !saved.includes('localhost')) setUrl(saved);
        });

        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const pulse = () => {
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.04, duration: 120, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
    };

    const handleSave = async () => {
        const trimmed = url.trim();
        if (!trimmed) {
            setStatus('error');
            setMessage('Please enter your server IP address.');
            return;
        }

        // Auto-prefix http:// if missing
        let fullUrl = trimmed;
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = `http://${fullUrl}`;
        }
        // Auto-append :8080 if no port specified
        if (!fullUrl.match(/:\d{2,5}(\/|$)/)) {
            fullUrl = `${fullUrl}:8080`;
        }

        setStatus('testing');
        setMessage('Testing connection...');
        pulse();

        const ok = await testServerConnection(fullUrl);
        if (ok) {
            await saveServerUrl(fullUrl);
            setStatus('success');
            setMessage('✅  Connected! Your app will use this server.');
            pulse();
        } else {
            setStatus('error');
            setMessage('❌  Could not reach the server. Check the IP and make sure backend is running.');
        }
    };

    const handleReset = async () => {
        await resetServerUrl();
        const fallback = await getServerBaseUrl();
        setUrl(fallback);
        setStatus('success');
        setMessage('✅  Reset to default Cloud URL.');
        pulse();
    };

    const statusColor = {
        idle: colors.textMuted,
        testing: colors.accentBlue || '#4C8EFF',
        success: colors.success || '#00D68F',
        error: colors.error || '#FF5C7C',
    }[status];

    const statusBg = {
        idle: 'transparent',
        testing: (colors.accentBlue || '#4C8EFF') + '14',
        success: (colors.success || '#00D68F') + '14',
        error: (colors.error || '#FF5C7C') + '14',
    }[status];

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.gradient}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            {/* Decorative glows */}
            <View style={themedStyles.glow1} />
            <View style={themedStyles.glow2} />

            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={themedStyles.flex}>
                    <ScrollView contentContainerStyle={themedStyles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                        {/* Header */}
                        <Animated.View style={[themedStyles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>

                            <View style={themedStyles.iconBadge}>
                                <LinearGradient colors={gradients.primary} style={themedStyles.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <Ionicons name="server-outline" size={30} color={colors.white} />
                                </LinearGradient>
                            </View>

                            <Text style={themedStyles.title}>Server Setup</Text>
                            <Text style={themedStyles.subtitle}>
                                Connect to your ProBloom backend running on your Local Network.
                            </Text>
                        </Animated.View>

                        {/* Instructions card */}
                        <Animated.View style={[themedStyles.infoCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <View style={themedStyles.infoRow}>
                                <Ionicons name="information-circle" size={20} color={colors.accentBlue || '#4C8EFF'} />
                                <Text style={themedStyles.infoTitle}>How to find your PC's IP</Text>
                            </View>
                            <View style={themedStyles.steps}>
                                <StepRow num="1" text="Make sure phone & PC are on the same Wi-Fi" colors={colors} />
                                <StepRow num="2" text="On PC: open PowerShell and run 'ipconfig'" colors={colors} />
                                <StepRow num="3" text={`Look for "IPv4 Address" under Wi-Fi adapter`} colors={colors} />
                                <StepRow num="4" text="Enter that IP below (e.g. 192.168.1.5)" colors={colors} />
                            </View>
                        </Animated.View>

                        {/* Input card */}
                        <Animated.View style={[themedStyles.card, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
                            <Text style={themedStyles.label}>SERVER IP ADDRESS</Text>

                            <View style={themedStyles.inputRow}>
                                <View style={themedStyles.prefixBox}>
                                    <Text style={themedStyles.prefix}>http://</Text>
                                </View>
                                <TextInput
                                    style={themedStyles.input}
                                    value={url.replace(/^https?:\/\//, '')}
                                    onChangeText={(t) => {
                                        setUrl(t);
                                        setStatus('idle');
                                        setMessage('');
                                    }}
                                    placeholder="192.168.x.x:8080"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="url"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            {/* Status feedback */}
                            {message ? (
                                <View style={[themedStyles.statusBox, { backgroundColor: statusBg, borderColor: statusColor + '4D' }]}>
                                    {status === 'testing' ? (
                                        <ActivityIndicator size="small" color={statusColor} />
                                    ) : (
                                        <Ionicons
                                            name={status === 'success' ? 'checkmark-circle' : 'alert-circle'}
                                            size={16}
                                            color={statusColor}
                                        />
                                    )}
                                    <Text style={[themedStyles.statusText, { color: statusColor }]}>{message}</Text>
                                </View>
                            ) : null}

                            {/* Save button */}
                            <TouchableOpacity
                                style={[themedStyles.saveBtn, status === 'testing' && themedStyles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={status === 'testing'}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={status === 'testing' ? [colors.border, colors.border] : gradients.primary}
                                    style={themedStyles.saveBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {status === 'testing' ? (
                                        <ActivityIndicator color={colors.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="wifi" size={18} color={colors.white} />
                                            <Text style={themedStyles.saveBtnText}>Test & Save</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {status === 'success' && (
                                <TouchableOpacity style={themedStyles.continueBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                                    <Text style={themedStyles.continueBtnText}>← Back to Settings</Text>
                                </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity 
                                style={themedStyles.resetBtn} 
                                onPress={handleReset}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="refresh-circle-outline" size={16} color={colors.textSecondary} />
                                <Text style={themedStyles.resetBtnText}>Reset to Default (Cloud)</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Tip */}
                        <View style={themedStyles.tipRow}>
                            <Ionicons name="bulb-outline" size={14} color={colors.warning} />
                            <Text style={themedStyles.tipText}>
                                Tip: Backend startup logs print your LAN IP automatically!
                            </Text>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function StepRow({ num, text, colors }: { num: string; text: string; colors: any }) {
    return (
        <View style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: (colors.accentBlue || '#4C8EFF') + '40' }]}>
                <Text style={[styles.stepNumText, { color: colors.accentBlue || '#4C8EFF' }]}>{num}</Text>
            </View>
            <Text style={[Typography.body2, { color: colors.textSecondary, flex: 1 }]}>{text}</Text>
        </View>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    flex: { flex: 1 },
    glow1: {
        position: 'absolute', width: 280, height: 280, borderRadius: 140,
        backgroundColor: colors.primary + '0D', top: -60, left: -80,
    },
    glow2: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: (colors.accentBlue || '#4C8EFF') + '0D', bottom: 120, right: -60,
    },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl },
    header: { alignItems: 'center', marginBottom: Spacing.xxl },
    backBtn: {
        position: 'absolute', left: 0, top: 0, width: 40, height: 40,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: colors.glass,
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border,
    },
    iconBadge: { marginBottom: Spacing.lg, marginTop: Spacing.xl },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
        ...Shadows.primary,
    },
    title: { ...Typography.h3, color: colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
    subtitle: { ...Typography.body2, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg },
    infoCard: {
        backgroundColor: (colors.accentBlue || '#4C8EFF') + '0D',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        borderWidth: 1, borderColor: (colors.accentBlue || '#4C8EFF') + '33',
        marginBottom: Spacing.xl,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
    infoTitle: { ...Typography.h5, color: colors.accentBlue || '#4C8EFF' },
    steps: { gap: 10 },
    card: {
        backgroundColor: colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        borderWidth: 1, borderColor: colors.border,
        ...Shadows.lg,
        marginBottom: Spacing.lg,
    },
    label: { ...Typography.overline, color: colors.textMuted, marginBottom: Spacing.md },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.glass,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
    },
    prefixBox: {
        paddingHorizontal: Spacing.md, paddingVertical: 15,
        backgroundColor: (colors.accentBlue || '#4C8EFF') + '1A',
        borderRightWidth: 1, borderRightColor: colors.border,
    },
    prefix: { ...Typography.body2, color: colors.accentBlue || '#4C8EFF', fontWeight: '600' },
    input: {
        flex: 1, ...Typography.body1, color: colors.textPrimary,
        paddingHorizontal: Spacing.md, paddingVertical: 15,
    },
    statusBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: Spacing.md, borderRadius: Radius.md,
        borderWidth: 1, marginBottom: Spacing.lg,
    },
    statusText: { ...Typography.body2, flex: 1 },
    saveBtn: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md, ...Shadows.primary },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 10,
    },
    saveBtnText: { ...Typography.button, color: colors.white },
    continueBtn: {
        alignItems: 'center', paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.glass,
    },
    continueBtnText: { ...Typography.buttonSm, color: colors.textPrimary },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.xl,
        gap: 6,
        padding: Spacing.sm,
    },
    resetBtnText: {
        ...Typography.body2,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    tipRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        justifyContent: 'center', paddingHorizontal: Spacing.lg,
    },
    tipText: { ...Typography.caption, color: colors.textMuted, flex: 1 },
});

const styles = StyleSheet.create({
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepNum: {
        width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 1,
    },
    stepNumText: { fontSize: 11, fontWeight: '700' },
});
