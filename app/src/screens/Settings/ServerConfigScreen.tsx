import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveServerUrl, testServerConnection, getServerBaseUrl } from '../../config/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

type Status = 'idle' | 'testing' | 'success' | 'error';

export default function ServerConfigScreen({ navigation }: any) {
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
        // Auto-append :5001 if no port specified
        if (!fullUrl.match(/:\d{2,5}(\/|$)/)) {
            fullUrl = `${fullUrl}:5001`;
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

    const statusColor = {
        idle: Colors.textMuted,
        testing: Colors.accentBlue,
        success: Colors.success,
        error: Colors.error,
    }[status];

    const statusBg = {
        idle: 'transparent',
        testing: 'rgba(76,142,255,0.08)',
        success: 'rgba(0,214,143,0.08)',
        error: 'rgba(255,92,124,0.08)',
    }[status];

    return (
        <LinearGradient colors={['#0A0C18', '#0D0F1A', '#111428']} style={styles.gradient}>
            {/* Decorative glows */}
            <View style={styles.glow1} />
            <View style={styles.glow2} />

            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                        {/* Header */}
                        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                                <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
                            </TouchableOpacity>

                            <View style={styles.iconBadge}>
                                <LinearGradient colors={['#4C8EFF', '#2563EB']} style={styles.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <Ionicons name="server-outline" size={30} color={Colors.white} />
                                </LinearGradient>
                            </View>

                            <Text style={styles.title}>Server Setup</Text>
                            <Text style={styles.subtitle}>
                                Connect to your Kitchen Master backend running on your PC / server.
                            </Text>
                        </Animated.View>

                        {/* Instructions card */}
                        <Animated.View style={[styles.infoCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.infoRow}>
                                <Ionicons name="information-circle" size={20} color={Colors.accentBlue} />
                                <Text style={styles.infoTitle}>How to find your PC's IP</Text>
                            </View>
                            <View style={styles.steps}>
                                <StepRow num="1" text="Make sure phone & PC are on the same Wi-Fi" />
                                <StepRow num="2" text="On PC: open PowerShell and run  ipconfig" />
                                <StepRow num="3" text={`Look for "IPv4 Address" under Wi-Fi adapter`} />
                                <StepRow num="4" text="Enter that IP below (e.g. 192.168.1.5)" />
                            </View>
                        </Animated.View>

                        {/* Input card */}
                        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
                            <Text style={styles.label}>SERVER IP ADDRESS</Text>

                            <View style={styles.inputRow}>
                                <View style={styles.prefixBox}>
                                    <Text style={styles.prefix}>http://</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={url.replace(/^https?:\/\//, '')}
                                    onChangeText={(t) => {
                                        setUrl(t);
                                        setStatus('idle');
                                        setMessage('');
                                    }}
                                    placeholder="192.168.x.x:5001"
                                    placeholderTextColor={Colors.textMuted}
                                    keyboardType="url"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            {/* Status feedback */}
                            {message ? (
                                <View style={[styles.statusBox, { backgroundColor: statusBg, borderColor: `${statusColor}30` }]}>
                                    {status === 'testing' ? (
                                        <ActivityIndicator size="small" color={statusColor} />
                                    ) : (
                                        <Ionicons
                                            name={status === 'success' ? 'checkmark-circle' : 'alert-circle'}
                                            size={16}
                                            color={statusColor}
                                        />
                                    )}
                                    <Text style={[styles.statusText, { color: statusColor }]}>{message}</Text>
                                </View>
                            ) : null}

                            {/* Save button */}
                            <TouchableOpacity
                                style={[styles.saveBtn, status === 'testing' && styles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={status === 'testing'}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={status === 'testing' ? ['#555', '#444'] : ['#4C8EFF', '#2563EB']}
                                    style={styles.saveBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {status === 'testing' ? (
                                        <ActivityIndicator color={Colors.white} size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="wifi" size={18} color={Colors.white} />
                                            <Text style={styles.saveBtnText}>Test & Save</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {status === 'success' && (
                                <TouchableOpacity style={styles.continueBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                                    <Text style={styles.continueBtnText}>← Back to Login</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>

                        {/* Tip */}
                        <View style={styles.tipRow}>
                            <Ionicons name="bulb-outline" size={14} color={Colors.accentYellow} />
                            <Text style={styles.tipText}>
                                Tip: Backend startup logs print your LAN IP automatically!
                            </Text>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function StepRow({ num, text }: { num: string; text: string }) {
    return (
        <View style={styles.stepRow}>
            <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{num}</Text>
            </View>
            <Text style={styles.stepText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    flex: { flex: 1 },
    glow1: {
        position: 'absolute', width: 280, height: 280, borderRadius: 140,
        backgroundColor: 'rgba(76, 142, 255, 0.08)', top: -60, left: -80,
    },
    glow2: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(255, 107, 53, 0.06)', bottom: 120, right: -60,
    },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
    header: { alignItems: 'center', marginBottom: Spacing.xxl, marginTop: Spacing.lg },
    backBtn: {
        position: 'absolute', left: 0, top: 0,
        padding: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    iconBadge: { marginBottom: Spacing.lg, marginTop: Spacing.xl },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
        ...Shadows.blue,
    },
    title: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
    subtitle: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg },
    infoCard: {
        backgroundColor: 'rgba(76, 142, 255, 0.06)',
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        borderWidth: 1, borderColor: 'rgba(76, 142, 255, 0.2)',
        marginBottom: Spacing.xl,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
    infoTitle: { ...Typography.h5, color: Colors.accentBlue },
    steps: { gap: 10 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepNum: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: 'rgba(76, 142, 255, 0.25)',
        justifyContent: 'center', alignItems: 'center',
        marginTop: 1,
    },
    stepNumText: { fontSize: 11, fontWeight: '700', color: Colors.accentBlue },
    stepText: { ...Typography.body2, color: Colors.textSecondary, flex: 1 },
    card: {
        backgroundColor: 'rgba(26, 32, 64, 0.85)',
        borderRadius: Radius.xl,
        padding: Spacing.xxl,
        borderWidth: 1, borderColor: Colors.glassBorder,
        ...Shadows.lg,
        marginBottom: Spacing.lg,
    },
    label: { ...Typography.overline, color: Colors.textMuted, marginBottom: Spacing.md },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border,
        backgroundColor: Colors.glass,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
    },
    prefixBox: {
        paddingHorizontal: Spacing.md, paddingVertical: 15,
        backgroundColor: 'rgba(76, 142, 255, 0.1)',
        borderRightWidth: 1, borderRightColor: Colors.border,
    },
    prefix: { ...Typography.body2, color: Colors.accentBlue, fontWeight: '600' },
    input: {
        flex: 1, ...Typography.body1, color: Colors.textPrimary,
        paddingHorizontal: Spacing.md, paddingVertical: 15,
    },
    statusBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: Spacing.md, borderRadius: Radius.md,
        borderWidth: 1, marginBottom: Spacing.lg,
    },
    statusText: { ...Typography.body2, flex: 1 },
    saveBtn: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md, ...Shadows.blue },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, gap: 10,
    },
    saveBtnText: { ...Typography.button, color: Colors.white },
    continueBtn: {
        alignItems: 'center', paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.borderLight,
        backgroundColor: Colors.glass,
    },
    continueBtnText: { ...Typography.buttonSm, color: Colors.textPrimary },
    tipRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        justifyContent: 'center', paddingHorizontal: Spacing.lg,
    },
    tipText: { ...Typography.caption, color: Colors.textMuted, flex: 1 },
});
