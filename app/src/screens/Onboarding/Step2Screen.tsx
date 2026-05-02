import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

export default function Step2Screen({ navigation }: any) {
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

    const features = [
        { icon: 'camera', title: 'Menu Digitizer', desc: 'Scan physical menus with AI' },
        { icon: 'mic', title: 'Voice Orders', desc: 'Dictate orders hands-free' },
        { icon: 'trending-up', title: 'Smart Upsell', desc: 'Boost average bill value' },
    ];

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <View style={themedStyles.bgOrb} />

            <Animated.View style={[themedStyles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={[{ alignItems: 'center', transform: [{ scale: iconScale }] }]}>
                    <LinearGradient colors={[colors.accentBlue || '#4C8EFF', colors.accentBlue || '#2563EB']} style={themedStyles.heroCircle}>
                        <Ionicons name="sparkles" size={56} color={colors.white} />
                    </LinearGradient>
                </Animated.View>
            </Animated.View>

            <Animated.View style={[themedStyles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={themedStyles.dots}>
                    <View style={themedStyles.dot} />
                    <View style={[themedStyles.dot, themedStyles.activeDot, { backgroundColor: colors.accentBlue || '#4C8EFF' }]} />
                    <View style={themedStyles.dot} />
                </View>

                <Text style={themedStyles.title}>AI-Powered Precision</Text>
                <Text style={themedStyles.desc}>
                    Supercharge your restaurant with Gemini AI. Digitize menus, take voice orders, and predict inventory needs.
                </Text>

                <View style={themedStyles.featureList}>
                    {features.map(f => (
                        <View key={f.title} style={themedStyles.featureRow}>
                            <View style={themedStyles.featureIcon}>
                                <LinearGradient colors={[colors.accentBlue || '#4C8EFF', colors.accentBlue || '#2563EB']} style={themedStyles.featureIconGrad}>
                                    <Ionicons name={f.icon as any} size={18} color={colors.white} />
                                </LinearGradient>
                            </View>
                            <View>
                                <Text style={themedStyles.featureTitle}>{f.title}</Text>
                                <Text style={themedStyles.featureDesc}>{f.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={themedStyles.nextBtn} onPress={() => navigation.navigate('OnboardingStep3')} activeOpacity={0.85}>
                    <LinearGradient colors={[colors.accentBlue || '#4C8EFF', colors.accentBlue || '#2563EB']} style={themedStyles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={themedStyles.nextBtnText}>Almost There</Text>
                        <Ionicons name="arrow-forward" size={20} color={colors.white} />
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    bgOrb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: (colors.accentBlue || '#4C8EFF') + '14', top: -150, left: -100 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.accentBlue || '#4C8EFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
    },
    bottomSheet: {
        backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: colors.border,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    activeDot: { width: 28, borderRadius: 4 },
    title: { ...Typography.h2, color: colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    featureList: { gap: 14, marginBottom: Spacing.xl },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: { borderRadius: 12, overflow: 'hidden' },
    featureIconGrad: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    featureTitle: { ...Typography.h5, color: colors.textPrimary },
    featureDesc: { ...Typography.caption, color: colors.textSecondary },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', ...Shadows.blue },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: colors.white },
});
