import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Easing, Image, StatusBar, Linking
} from 'react-native';

const logoImg = require('../../../assets/LOGO.jpeg');
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [focusedInput, setFocusedInput] = useState<'loginId' | 'password' | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'fetching' | 'ready' | 'denied'>('fetching');
    const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
    const { login, stakeholderLogin, isLoading, error, clearError } = useAuthStore();

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
        if (!loginId.trim()) return;
        if (!password.trim()) return;

        Animated.sequence([
            Animated.timing(btnScaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(btnScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();

        const coords = locationRef.current;
        try {
            const isEmail = loginId.includes('@');
            
            if (isEmail) {
                await login(
                    loginId.trim().toLowerCase(),
                    password,
                    coords?.latitude ?? undefined,
                    coords?.longitude ?? undefined
                );
            } else {
                await stakeholderLogin(
                    loginId.trim(),
                    password,
                    coords?.latitude ?? undefined,
                    coords?.longitude ?? undefined
                );
            }
        } catch (_) { }
    };

    // Interpolations
    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
    const orb1X = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
    const orb2Y = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
    const orb2X = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });

    return (
        <View style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            {/* Absolute Deep Background */}
            <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFillObject} />

            {/* Floating Ambient Orbs */}
            <Animated.View style={[themedStyles.orb, themedStyles.orbTopRight, { transform: [{ translateY: orb1Y }, { translateX: orb1X }] }]} />
            <Animated.View style={[themedStyles.orb, themedStyles.orbBottomLeft, { transform: [{ translateY: orb2Y }, { translateX: orb2X }] }]} />

            {__DEV__ && (
                <SafeAreaView style={themedStyles.settingsArea} pointerEvents="box-none">
                    <TouchableOpacity style={themedStyles.settingsBtn} onPress={() => navigation.navigate('ServerConfig')} activeOpacity={0.7}>
                        <Ionicons name="hardware-chip-outline" size={20} color={colors.textPrimary} />
                        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} tint={isDark ? "dark" : "light"} />
                    </TouchableOpacity>
                </SafeAreaView>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={themedStyles.flex}>
                <ScrollView contentContainerStyle={themedStyles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    <Animated.View style={[themedStyles.contentWrapper, { opacity: entranceAnim, transform: [{ translateY }] }]}>

                        {/* Header Area */}
                        <View style={themedStyles.header}>
                            <View style={themedStyles.logoWrapper}>
                                <View style={themedStyles.logoCircle}>
                                    <Image
                                        source={logoImg}
                                        style={themedStyles.logoImage}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View style={themedStyles.logoOuterGlow} />
                            </View>
                            <Text style={themedStyles.title}>
                                <Text style={{color: colors.primary}}>P</Text>ro<Text style={{color: colors.primary}}>B</Text>loom
                            </Text>
                            <Text style={themedStyles.subtitle}>Welcomes You</Text>
                            <Text style={themedStyles.subtitle}>Enter your credentials to access the command center.</Text>
                        </View>

                        {/* Premium Glassmorphic Card */}
                        <View style={themedStyles.glassContainer}>
                            <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={themedStyles.glassBlur}>

                                {error && (
                                    <Animated.View style={themedStyles.errorBanner}>
                                        <Ionicons name="warning" size={18} color={colors.error} />
                                        <Text style={themedStyles.errorText}>{error}</Text>
                                        <TouchableOpacity onPress={clearError} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Ionicons name="close" size={16} color={colors.error} />
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}

                                <View style={themedStyles.formGroup}>
                                    <Text style={themedStyles.label}>Email Address or Phone Number</Text>
                                    <View style={[themedStyles.inputWrapper, focusedInput === 'loginId' && themedStyles.inputWrapperFocused]}>
                                        <Ionicons name="person-circle-outline" size={18} color={focusedInput === 'loginId' ? colors.primary : colors.textMuted} style={themedStyles.inputIcon} />
                                        <TextInput
                                            style={themedStyles.input}
                                            value={loginId}
                                            onChangeText={setLoginId}
                                            placeholder="admin@probloom.com or +1234..."
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            onFocus={() => setFocusedInput('loginId')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                    </View>
                                </View>

                                <View style={themedStyles.formGroup}>
                                    <Text style={themedStyles.label}>Password</Text>
                                    <View style={[themedStyles.inputWrapper, focusedInput === 'password' && themedStyles.inputWrapperFocused]}>
                                        <Ionicons name="lock-closed" size={18} color={focusedInput === 'password' ? colors.primary : colors.textMuted} style={themedStyles.inputIcon} />
                                        <TextInput
                                            style={themedStyles.input}
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textMuted}
                                            secureTextEntry={!showPassword}
                                            onFocus={() => setFocusedInput('password')}
                                            onBlur={() => setFocusedInput(null)}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={themedStyles.eyeBtn}>
                                            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity style={themedStyles.forgotBtn}>
                                    <Text style={themedStyles.forgotText}>Forgot password?</Text>
                                </TouchableOpacity>

                                {/* GPS Status Indicator */}
                                <View style={themedStyles.gpsRow}>
                                    <Ionicons
                                        name={gpsStatus === 'ready' ? 'location' : gpsStatus === 'fetching' ? 'navigate-outline' : 'location-outline'}
                                        size={14}
                                        color={gpsStatus === 'ready' ? colors.success : gpsStatus === 'fetching' ? colors.warning : colors.error}
                                    />
                                    <Text style={[themedStyles.gpsText, { color: gpsStatus === 'ready' ? colors.success : gpsStatus === 'fetching' ? colors.warning : colors.error }]}>
                                        {gpsStatus === 'ready' ? 'Location acquired' : gpsStatus === 'fetching' ? 'Getting your location…' : 'Location access denied — employees may be blocked'}
                                    </Text>
                                </View>

                                <Animated.View style={{ transform: [{ scale: btnScaleAnim }] }}>
                                    <TouchableOpacity
                                        style={[themedStyles.primaryBtn, (!loginId || !password || isLoading) && themedStyles.primaryBtnDisabled]}
                                        onPress={handleLogin}
                                        disabled={isLoading || !loginId || !password}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={(!loginId || !password) ? [colors.primary + '80', colors.primary + '80'] : gradients.primary}
                                            style={StyleSheet.absoluteFillObject}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        />
                                        <Text style={themedStyles.primaryBtnText}>{isLoading ? 'Authenticating...' : 'Sign In'}</Text>
                                        {!isLoading && <Ionicons name="arrow-forward" size={18} color={colors.white} style={{ marginLeft: 8 }} />}
                                    </TouchableOpacity>
                                </Animated.View>

                            </BlurView>
                        </View>

                        <View style={themedStyles.footer}>
                            <Text style={themedStyles.footerText}>New to ProBloom?</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://probloom.com')} activeOpacity={0.7}>
                                <Text style={themedStyles.footerLink}> Purchase Credentials</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background[0] },
    flex: { flex: 1 },
    orb: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, opacity: 0.15 },
    orbTopRight: { backgroundColor: colors.primary, top: -width * 0.4, right: -width * 0.2 },
    orbBottomLeft: { backgroundColor: colors.accentBlue || '#4C8EFF', bottom: -width * 0.4, left: -width * 0.3 },
    settingsArea: { position: 'absolute', top: 0, right: 0, zIndex: 50 },
    settingsBtn: { margin: Spacing.xl, width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
    contentWrapper: { width: '100%', maxWidth: 440, alignSelf: 'center' },
    header: { alignItems: 'center', marginBottom: Spacing.xxxl },
    logoWrapper: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xl },
    logoCircle: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'white', overflow: 'hidden', ...Shadows.primary },
    logoImage: { width: '100%', height: '100%' },
    logoOuterGlow: { position: 'absolute', width: 80, height: 80, borderRadius: 30, backgroundColor: colors.primary + '26', borderWidth: 1, borderColor: colors.primary + '4D' },
    title: { ...Typography.h1, color: colors.textPrimary, marginBottom: Spacing.sm, letterSpacing: -0.5 },
    subtitle: { ...Typography.body1, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
    glassContainer: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.lg },
    glassBlur: { padding: Spacing.xxl },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.error + '26', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.error + '4D', marginBottom: Spacing.xl, gap: 10 },
    errorText: { flex: 1, ...Typography.body2, color: colors.error },
    formGroup: { marginBottom: Spacing.xl },
    label: { ...Typography.overline, color: colors.textSecondary, marginBottom: Spacing.sm, letterSpacing: 1.5 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: colors.glass, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.lg },
    inputWrapperFocused: { backgroundColor: colors.primary + '0D', borderColor: colors.primary + '66' },
    inputIcon: { marginRight: Spacing.md },
    input: { flex: 1, ...Typography.body1, color: colors.textPrimary, height: '100%' },
    eyeBtn: { padding: Spacing.sm, marginRight: -Spacing.sm },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.xxl },
    forgotText: { ...Typography.body2, color: colors.textSecondary, fontWeight: '500' },
    primaryBtn: { height: 56, borderRadius: Radius.md, overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { ...Typography.button, color: colors.white, letterSpacing: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxxl },
    footerText: { ...Typography.body1, color: colors.textSecondary },
    footerLink: { ...Typography.body1, color: colors.textPrimary, fontWeight: '600' },
    gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl, paddingHorizontal: 4 },
    gpsText: { ...Typography.caption, fontSize: 12, flex: 1 },
    tabsRow: { flexDirection: 'row', backgroundColor: colors.glass, borderRadius: Radius.md, padding: 4, marginBottom: Spacing.xl, borderWidth: 1, borderColor: colors.border },
    tabBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    activeTabBtn: { backgroundColor: colors.primary + '26', borderWidth: 1, borderColor: colors.primary + '33' },
    tabText: { ...Typography.body2, color: colors.textSecondary, fontWeight: '600' },
    activeTabText: { color: colors.primary, fontWeight: '700' },
});
