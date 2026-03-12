import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

const { width } = Dimensions.get('window');

type FormKey = 'name' | 'email' | 'password' | 'restaurantName' | 'phone';

interface FieldDef {
    icon: string;
    label: string;
    field: FormKey;
    placeholder: string;
    keyboardType?: any;
    secure?: boolean;
    autoCapitalize?: any;
}

const FIELDS: FieldDef[] = [
    { icon: 'person', label: 'Your Name', field: 'name', placeholder: 'John Doe', autoCapitalize: 'words' },
    { icon: 'restaurant', label: 'Restaurant Name', field: 'restaurantName', placeholder: 'My Restaurant', autoCapitalize: 'words' },
    { icon: 'mail', label: 'Email Address', field: 'email', placeholder: 'you@restaurant.com', keyboardType: 'email-address', autoCapitalize: 'none' },
    { icon: 'call', label: 'Phone Number', field: 'phone', placeholder: '+91 9876543210', keyboardType: 'phone-pad', autoCapitalize: 'none' },
    { icon: 'lock-closed', label: 'Password', field: 'password', placeholder: 'Min. 6 characters', secure: true, autoCapitalize: 'none' },
];

export default function RegisterScreen({ navigation }: any) {
    const [form, setForm] = useState({ name: '', email: '', password: '', restaurantName: '', phone: '' });
    const [showPw, setShowPw] = useState(false);
    const [focused, setFocused] = useState<FormKey | null>(null);
    const { register, isLoading, error, clearError } = useAuthStore();

    // ─── Animations ─────────────────────────────────────────────────────────
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;
    const btnScaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(entranceAnim, {
            toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start();

        const floatAnim = (value: Animated.Value, duration: number, delay: number = 0) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
                ])
            ).start();
        };

        floatAnim(orb1Anim, 9000);
        floatAnim(orb2Anim, 11000, 1500);
    }, []);

    const set = (key: FormKey, val: string) => setForm(f => ({ ...f, [key]: val }));

    const handleRegister = async () => {
        if (!form.name || !form.email || !form.password || !form.restaurantName) return;

        Animated.sequence([
            Animated.timing(btnScaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(btnScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();

        try { await register(form); } catch (_) { }
    };

    const isFormValid = !!(form.name && form.email && form.password.length >= 6 && form.restaurantName);

    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
    const orb2X = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#05050A', '#0D0F1A', '#080912']} style={StyleSheet.absoluteFillObject} />

            <Animated.View style={[styles.orb, styles.orbTopLeft, { transform: [{ translateY: orb1Y }] }]} />
            <Animated.View style={[styles.orb, styles.orbBottomRight, { transform: [{ translateX: orb2X }] }]} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    <Animated.View style={[styles.contentWrapper, { opacity: entranceAnim, transform: [{ translateY }] }]}>

                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color={Colors.white} />
                        </TouchableOpacity>

                        <View style={styles.header}>
                            <LinearGradient colors={['#FF6B35', '#4C8EFF']} style={styles.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <Ionicons name="rocket" size={28} color={Colors.white} />
                            </LinearGradient>
                            <Text style={styles.title}>Create Account</Text>
                            <Text style={styles.subtitle}>Start managing your restaurant the modern way.</Text>
                        </View>

                        <View style={styles.glassContainer}>
                            <BlurView intensity={30} tint="dark" style={styles.glassBlur}>

                                {error && (
                                    <View style={styles.errorBanner}>
                                        <Ionicons name="warning" size={18} color="#FF4A4A" />
                                        <Text style={styles.errorText}>{error}</Text>
                                        <TouchableOpacity onPress={clearError}>
                                            <Ionicons name="close" size={16} color="#FF4A4A" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {FIELDS.map(f => (
                                    <View key={f.field} style={styles.formGroup}>
                                        <Text style={styles.label}>{f.label}{f.field !== 'phone' ? ' *' : ''}</Text>
                                        <View style={[styles.inputWrapper, focused === f.field && styles.inputWrapperFocused]}>
                                            <Ionicons name={f.icon as any} size={18} color={focused === f.field ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                value={form[f.field]}
                                                onChangeText={v => set(f.field, v)}
                                                placeholder={f.placeholder}
                                                placeholderTextColor="rgba(255,255,255,0.3)"
                                                keyboardType={f.keyboardType || 'default'}
                                                autoCapitalize={f.autoCapitalize || 'sentences'}
                                                secureTextEntry={f.secure && !showPw}
                                                autoCorrect={false}
                                                onFocus={() => setFocused(f.field)}
                                                onBlur={() => setFocused(null)}
                                            />
                                            {f.secure && (
                                                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                                                    <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}

                                <Animated.View style={{ transform: [{ scale: btnScaleAnim }], marginTop: Spacing.xl }}>
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, (!isFormValid || isLoading) && styles.primaryBtnDisabled]}
                                        onPress={handleRegister}
                                        disabled={isLoading || !isFormValid}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={(!isFormValid) ? ['rgba(255,107,53,0.5)', 'rgba(229,90,36,0.5)'] : ['#FF8A5C', '#FF6B35']}
                                            style={StyleSheet.absoluteFillObject}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        />
                                        <Text style={styles.primaryBtnText}>{isLoading ? 'Creating...' : 'Create Account'}</Text>
                                        {!isLoading && <Ionicons name="arrow-forward" size={18} color={Colors.white} style={{ marginLeft: 8 }} />}
                                    </TouchableOpacity>
                                </Animated.View>

                            </BlurView>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                                <Text style={styles.footerLink}> Sign In</Text>
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
    orb: { position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width * 0.75, filter: [{ blur: 90 }] as any, opacity: 0.12 },
    orbTopLeft: { backgroundColor: '#FF6B35', top: -width * 0.5, left: -width * 0.5 },
    orbBottomRight: { backgroundColor: '#9B59B6', bottom: -width * 0.5, right: -width * 0.5 },
    scrollContent: { flexGrow: 1, padding: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    contentWrapper: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: Spacing.xxxl },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xxl },
    header: { marginBottom: Spacing.xxxl },
    iconCircle: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.primary },
    title: { ...Typography.h1, color: Colors.white, marginBottom: Spacing.xs, letterSpacing: -0.5 },
    subtitle: { ...Typography.body1, color: Colors.textSecondary },
    glassContainer: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(20,22,35,0.4)', ...Shadows.lg },
    glassBlur: { padding: Spacing.xxl },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,74,74,0.15)', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,74,74,0.3)', marginBottom: Spacing.xl, gap: 10 },
    errorText: { flex: 1, ...Typography.body2, color: '#FF9E9E' },
    formGroup: { marginBottom: Spacing.lg },
    label: { ...Typography.overline, color: Colors.textSecondary, marginBottom: Spacing.sm, letterSpacing: 1.5 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: Spacing.lg },
    inputWrapperFocused: { backgroundColor: 'rgba(255,107,53,0.05)', borderColor: 'rgba(255,107,53,0.4)' },
    inputIcon: { marginRight: Spacing.md },
    input: { flex: 1, ...Typography.body1, color: Colors.white, height: '100%' },
    eyeBtn: { padding: Spacing.sm, marginRight: -Spacing.sm },
    primaryBtn: { height: 56, borderRadius: Radius.md, overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { ...Typography.button, color: Colors.white, letterSpacing: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxxl },
    footerText: { ...Typography.body1, color: Colors.textSecondary },
    footerLink: { ...Typography.body1, color: Colors.white, fontWeight: '600' }
});
