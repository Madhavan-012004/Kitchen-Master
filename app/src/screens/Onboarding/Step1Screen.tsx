import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Image, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const logoImg = require('../../../assets/LOGO.jpeg');
const W = Dimensions.get('window').width;

export default function Step1Screen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const iconScale = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
            Animated.spring(iconScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <View style={themedStyles.bgOrb1} />
            <View style={themedStyles.bgOrb2} />

            <Animated.View style={[themedStyles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={[themedStyles.heroGraphic, { transform: [{ scale: iconScale }] }]}>
                    <View style={themedStyles.heroCircle}>
                        <Image source={logoImg} style={themedStyles.logoImage} resizeMode="contain" />
                    </View>
                    <View style={themedStyles.floatingChip1}>
                        <Text style={themedStyles.chipEmoji}>⚡</Text>
                        <Text style={themedStyles.chipText}>0.3s/order</Text>
                    </View>
                    <View style={themedStyles.floatingChip2}>
                        <Text style={themedStyles.chipEmoji}>📱</Text>
                        <Text style={themedStyles.chipText}>Any device</Text>
                    </View>
                </Animated.View>
            </Animated.View>

            <Animated.View style={[themedStyles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={themedStyles.dots}>
                    <View style={[themedStyles.dot, themedStyles.activeDot]} />
                    <View style={themedStyles.dot} />
                    <View style={themedStyles.dot} />
                </View>

                <Text style={themedStyles.title}>Lightning Fast Billing</Text>
                <Text style={themedStyles.desc}>
                    Turn any phone or tablet into a high-speed POS. No bulky hardware. Orders in seconds, not minutes.
                </Text>

                <View style={themedStyles.featureRow}>
                    {['Intuitive UI', 'Offline Ready', 'Multi-device'].map(f => (
                        <View key={f} style={themedStyles.featureChip}>
                            <Ionicons name="checkmark" size={12} color={colors.primary} />
                            <Text style={themedStyles.featureText}>{f}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={themedStyles.nextBtn} onPress={() => navigation.navigate('OnboardingStep2')} activeOpacity={0.85}>
                    <LinearGradient colors={gradients.primary} style={themedStyles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={themedStyles.nextBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.white} />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => useAuthStore.getState().logout()}>
                    <Text style={themedStyles.skipText}>Sign out / Switch account</Text>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    bgOrb1: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: colors.primary + '12', top: -100, right: -100 },
    bgOrb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: (colors.accentBlue || '#4C8EFF') + '0D', bottom: 200, left: -80 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroGraphic: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
        backgroundColor: 'white', overflow: 'hidden',
    },
    logoImage: { width: '80%', height: '80%' },
    floatingChip1: {
        position: 'absolute', top: -20, right: -80, flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: colors.card, borderRadius: Radius.round,
        paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border,
    },
    floatingChip2: {
        position: 'absolute', bottom: -20, left: -90, flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: colors.card, borderRadius: Radius.round,
        paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border,
    },
    chipEmoji: { fontSize: 14 },
    chipText: { ...Typography.caption, color: colors.textPrimary, fontWeight: '700' },
    bottomSheet: {
        backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: colors.border,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    activeDot: { width: 28, borderRadius: 4, backgroundColor: colors.primary },
    title: { ...Typography.h2, color: colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    featureRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xxl, flexWrap: 'wrap' },
    featureChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: colors.primary + '1A', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.round, borderWidth: 1, borderColor: colors.primary + '4D',
    },
    featureText: { ...Typography.caption, color: colors.primary, fontWeight: '700' },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadows.primary },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: colors.white },
    skipText: { ...Typography.caption, color: colors.textMuted, textAlign: 'center' },
});
