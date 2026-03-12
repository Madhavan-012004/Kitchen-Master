import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { authAPI } from '../../api/auth';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

export default function Step3Screen({ navigation }: any) {
    const { user, updateUser } = useAuthStore();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const iconScale = useRef(new Animated.Value(0.5)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
            Animated.spring(iconScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleFinish = async () => {
        try {
            const res = await authAPI.completeOnboarding(3, {});
            updateUser(res.data.data.user);
        } catch (error) { console.error(error); }
    };

    const achievements = [
        { icon: 'checkmark-circle', label: 'Account created', color: Colors.accentGreen },
        { icon: 'checkmark-circle', label: 'AI tools activated', color: Colors.accentGreen },
        { icon: 'checkmark-circle', label: 'Ready to take orders', color: Colors.accentGreen },
    ];

    return (
        <LinearGradient colors={['#0A0C18', '#0D0F1A', '#0F1428']} style={styles.container}>
            <View style={styles.bgOrb} />

            <Animated.View style={[styles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <LinearGradient colors={['#00D68F', '#00B377']} style={styles.heroCircle}>
                        <Ionicons name="rocket" size={56} color={Colors.white} />
                    </LinearGradient>
                </Animated.View>

                {user?.restaurantName && (
                    <Animated.View style={[styles.nameTag, { opacity: fadeAnim }]}>
                        <Text style={styles.nameTagText}>🎉 {user.restaurantName} is ready!</Text>
                    </Animated.View>
                )}
            </Animated.View>

            <Animated.View style={[styles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.dots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.activeDot, { backgroundColor: Colors.accentGreen }]} />
                </View>

                <Text style={styles.title}>Ready to Serve! 🚀</Text>
                <Text style={styles.desc}>
                    Welcome to Kitchen Master. Start by adding your menu items, set up your inventory, and let AI handle the rest.
                </Text>

                <View style={styles.achievementList}>
                    {achievements.map((a, i) => (
                        <View key={i} style={styles.achievementRow}>
                            <Ionicons name={a.icon as any} size={20} color={a.color} />
                            <Text style={styles.achievementText}>{a.label}</Text>
                        </View>
                    ))}
                </View>

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity style={styles.nextBtn} onPress={handleFinish} activeOpacity={0.85}>
                        <LinearGradient colors={['#00D68F', '#00B377']} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={styles.nextBtnText}>Launch Dashboard</Text>
                            <Ionicons name="rocket" size={20} color={Colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgOrb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(0,214,143,0.07)', top: -150, right: -100 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#00D68F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
    },
    nameTag: {
        backgroundColor: 'rgba(0,214,143,0.12)', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(0,214,143,0.3)',
    },
    nameTagText: { ...Typography.buttonSm, color: Colors.accentGreen },
    bottomSheet: {
        backgroundColor: 'rgba(19,23,43,0.95)', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
    activeDot: { width: 28, borderRadius: 4 },
    title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: Colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    achievementList: { gap: 12, marginBottom: Spacing.xl },
    achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    achievementText: { ...Typography.body1, color: Colors.textPrimary },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', ...Shadows.green },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: Colors.white },
});
