import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

export default function Step2Screen({ navigation }: any) {
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
        <LinearGradient colors={['#0A0C18', '#0D0F1A', '#0F1428']} style={styles.container}>
            <View style={styles.bgOrb} />

            <Animated.View style={[styles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={[{ alignItems: 'center', transform: [{ scale: iconScale }] }]}>
                    <LinearGradient colors={['#4C8EFF', '#2563EB']} style={styles.heroCircle}>
                        <Ionicons name="sparkles" size={56} color={Colors.white} />
                    </LinearGradient>
                </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.dots}>
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.activeDot, { backgroundColor: Colors.accentBlue }]} />
                    <View style={styles.dot} />
                </View>

                <Text style={styles.title}>AI-Powered Precision</Text>
                <Text style={styles.desc}>
                    Supercharge your restaurant with Gemini AI. Digitize menus, take voice orders, and predict inventory needs.
                </Text>

                <View style={styles.featureList}>
                    {features.map(f => (
                        <View key={f.title} style={styles.featureRow}>
                            <View style={styles.featureIcon}>
                                <LinearGradient colors={['#4C8EFF', '#2563EB']} style={styles.featureIconGrad}>
                                    <Ionicons name={f.icon as any} size={18} color={Colors.white} />
                                </LinearGradient>
                            </View>
                            <View>
                                <Text style={styles.featureTitle}>{f.title}</Text>
                                <Text style={styles.featureDesc}>{f.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.nextBtn} onPress={() => navigation.navigate('OnboardingStep3')} activeOpacity={0.85}>
                    <LinearGradient colors={['#4C8EFF', '#2563EB']} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.nextBtnText}>Almost There</Text>
                        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgOrb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(76,142,255,0.08)', top: -150, left: -100 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#4C8EFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
    },
    bottomSheet: {
        backgroundColor: 'rgba(19,23,43,0.95)', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
    activeDot: { width: 28, borderRadius: 4 },
    title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: Colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    featureList: { gap: 14, marginBottom: Spacing.xl },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: { borderRadius: 12, overflow: 'hidden' },
    featureIconGrad: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    featureTitle: { ...Typography.h5, color: Colors.textPrimary },
    featureDesc: { ...Typography.caption, color: Colors.textSecondary },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', ...Shadows.blue },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: Colors.white },
});
