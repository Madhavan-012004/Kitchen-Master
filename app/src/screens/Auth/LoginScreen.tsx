import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'fetching' | 'ready' | 'denied'>('fetching');
    const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
    const { login, isLoading, error, clearError } = useAuthStore();

    // ─── Animations ─────────────────────────────────────────────────────────
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;
    const btnScaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Request GPS permission and get position
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setGpsStatus('denied');
                    return;
                }
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                locationRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setGpsStatus('ready');
            } catch {
                setGpsStatus('denied');
            }
        })();

        // Entrance sequence
        Animated.timing(entranceAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Slow floating orbs background
        const floatAnim = (value: Animated.Value, duration: number, delay: number = 0) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
                ])
            ).start();
        };

        floatAnim(orb1Anim, 8000);
        floatAnim(orb2Anim, 12000, 2000);
    }, []);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) return;

        Animated.sequence([
            Animated.timing(btnScaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(btnScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();

        const coords = locationRef.current;
        try {
            await login(
                email.trim().toLowerCase(),
                password,
                coords?.latitude ?? undefined,
                coords?.longitude ?? undefined
            );
        } catch (_) { }
    };

    // Interpolations
    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
    const orb1X = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
    const orb2Y = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
    const orb2X = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });

    return (
        <View style={styles.container}>
            {/* Absolute Deep Background */}
            <LinearGradient colors={['#05050A', '#0D0F1A', '#080912']} style={StyleSheet.absoluteFillObject} />

            {/* Floating Ambient Orbs */}
            <Animated.View style={[styles.orb, styles.orbTopRight, { transform: [{ translateY: orb1Y }, { translateX: orb1X }] }]} />
            <Animated.View style={[styles.orb, styles.orbBottomLeft, { transform: [{ translateY: orb2Y }, { translateX: orb2X }] }]} />

            <SafeAreaView style={styles.settingsArea} pointerEvents="box-none">
                <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('ServerConfig')} activeOpacity={0.7}>
                    <Ionicons name="hardware-chip-outline" size={20} color={Colors.white} />
                    <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
                </TouchableOpacity>
            </SafeAreaView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    <Animated.View style={[styles.contentWrapper, { opacity: entranceAnim, transform: [{ translateY }] }]}>

                        {/* Header Area */}
                        <View style={styles.header}>
                            <View style={styles.logoWrapper}>
                                <LinearGradient colors={['#FF6B35', '#E55A24']} style={styles.logoCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                    <Ionicons name="restaurant" size={28} color={Colors.white} />
                                </LinearGradient>
                                <View style={styles.logoOuterGlow} />
                            </View>
                            <Text style={styles.title}>Kitchen Master</Text>
                            <Text style={styles.subtitle}>Welcomes You</Text>
                            <Text style={styles.subtitle}>Enter your credentials to access the command center.</Text>
                        </View>

                        {/* Premium Glassmorphic Card */}
                        <View style={styles.glassContainer}>
                            <BlurView intensity={30} tint="dark" style={styles.glassBlur}>

                                {error && (
                                    <Animated.View style={styles.errorBanner}>
                                        <Ionicons name="warning" size={18} color="#FF4A4A" />
                                        <Text style={styles.errorText}>{error}</Text>
                                        <TouchableOpacity onPress={clearError} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Ionicons name="close" size={16} color="#FF4A4A" />
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputWrapperFocused]}>
                                        <Ionicons name="mail" size={18} color={focusedInput === 'email' ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            value={email}
                                            onChangeText={setEmail}
                                            placeholder="admin@kitchenmaster.com"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            onFocus={() => setFocusedInput('email')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Password</Text>
                                    <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputWrapperFocused]}>
                                        <Ionicons name="lock-closed" size={18} color={focusedInput === 'password' ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            secureTextEntry={!showPassword}
                                            onFocus={() => setFocusedInput('password')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.forgotBtn}>
                                    <Text style={styles.forgotText}>Forgot password?</Text>
                                </TouchableOpacity>

                                {/* GPS Status Indicator */}
                                <View style={styles.gpsRow}>
                                    <Ionicons
                                        name={gpsStatus === 'ready' ? 'location' : gpsStatus === 'fetching' ? 'navigate-outline' : 'location-outline'}
                                        size={14}
                                        color={gpsStatus === 'ready' ? '#22c55e' : gpsStatus === 'fetching' ? '#f59e0b' : '#ef4444'}
                                    />
                                    <Text style={[styles.gpsText, { color: gpsStatus === 'ready' ? '#22c55e' : gpsStatus === 'fetching' ? '#f59e0b' : '#ef4444' }]}>
                                        {gpsStatus === 'ready' ? 'Location acquired' : gpsStatus === 'fetching' ? 'Getting your location…' : 'Location access denied — employees may be blocked'}
                                    </Text>
                                </View>

                                <Animated.View style={{ transform: [{ scale: btnScaleAnim }] }}>
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, (!email || !password || isLoading) && styles.primaryBtnDisabled]}
                                        onPress={handleLogin}
                                        disabled={isLoading || !email || !password}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={(!email || !password) ? ['rgba(255,107,53,0.5)', 'rgba(229,90,36,0.5)'] : ['#FF8A5C', '#FF6B35']}
                                            style={StyleSheet.absoluteFillObject}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        />
                                        <Text style={styles.primaryBtnText}>{isLoading ? 'Authenticating...' : 'Sign In'}</Text>
                                        {!isLoading && <Ionicons name="arrow-forward" size={18} color={Colors.white} style={{ marginLeft: 8 }} />}
                                    </TouchableOpacity>
                                </Animated.View>

                            </BlurView>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>New to Kitchen Master?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                                <Text style={styles.footerLink}> Create an account</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050A' },
    flex: { flex: 1 },
    orb: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, filter: [{ blur: 80 }] as any, opacity: 0.15 },
    orbTopRight: { backgroundColor: '#FF6B35', top: -width * 0.4, right: -width * 0.2 },
    orbBottomLeft: { backgroundColor: '#4C8EFF', bottom: -width * 0.4, left: -width * 0.3 },
    settingsArea: { position: 'absolute', top: 0, right: 0, zIndex: 50 },
    settingsBtn: { margin: Spacing.xl, width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    contentWrapper: { width: '100%', maxWidth: 440, alignSelf: 'center' },
    header: { alignItems: 'center', marginBottom: Spacing.xxxl },
    logoWrapper: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    logoCircle: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, ...Shadows.primary },
    logoOuterGlow: { position: 'absolute', width: 80, height: 80, borderRadius: 30, backgroundColor: 'rgba(255,107,53,0.15)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
    title: { ...Typography.h1, color: Colors.white, marginBottom: Spacing.sm, letterSpacing: -0.5 },
    subtitle: { ...Typography.body1, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
    glassContainer: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(20,22,35,0.4)', ...Shadows.lg },
    glassBlur: { padding: Spacing.xxl },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,74,74,0.15)', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,74,74,0.3)', marginBottom: Spacing.xl, gap: 10 },
    errorText: { flex: 1, ...Typography.body2, color: '#FF9E9E' },
    formGroup: { marginBottom: Spacing.xl },
    label: { ...Typography.overline, color: Colors.textSecondary, marginBottom: Spacing.sm, letterSpacing: 1.5 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: Spacing.lg },
    inputWrapperFocused: { backgroundColor: 'rgba(255,107,53,0.05)', borderColor: 'rgba(255,107,53,0.4)' },
    inputIcon: { marginRight: Spacing.md },
    input: { flex: 1, ...Typography.body1, color: Colors.white, height: '100%' },
    eyeBtn: { padding: Spacing.sm, marginRight: -Spacing.sm },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.xxl },
    forgotText: { ...Typography.body2, color: Colors.textSecondary, fontWeight: '500' },
    primaryBtn: { height: 56, borderRadius: Radius.md, overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { ...Typography.button, color: Colors.white, letterSpacing: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxxl },
    footerText: { ...Typography.body1, color: Colors.textSecondary },
    footerLink: { ...Typography.body1, color: Colors.white, fontWeight: '600' },
    gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl, paddingHorizontal: 4 },
    gpsText: { ...Typography.caption, fontSize: 12, flex: 1 },
});
