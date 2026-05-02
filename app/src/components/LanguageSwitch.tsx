import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, Animated, StyleSheet } from 'react-native';

interface LanguageSwitchProps {
    isTamil: boolean;
    onToggle: () => void;
}

export default function LanguageSwitch({ isTamil, onToggle }: LanguageSwitchProps) {
    const animatedValue = useRef(new Animated.Value(isTamil ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(animatedValue, {
            toValue: isTamil ? 1 : 0,
            useNativeDriver: false, // Must be false for left/margin interpolation
            bounciness: 0,
            speed: 20
        }).start();
    }, [isTamil]);

    // When isTamil is true (1), the white thumb moves right (indicator position)
    // Actually in the user CSS: TA is on the left (on), EN is on the right (off).
    // When checked (isTamil == true): thumb moves right (covers EN). Wait.
    // CSS: input.check-toggle-round-flat:checked + label:after { margin-left: 32px; }
    // If it moves right (margin-left: 32px), it's sitting over the right side.
    const thumbPosition = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [3, 35] // 3 is left, 35 is right (70 width - 32 width - 3 padding)
    });

    return (
        <TouchableWithoutFeedback onPress={onToggle}>
            <View style={styles.container}>
                {/* The animated white thumb */}
                <Animated.View style={[styles.thumb, { left: thumbPosition }]} />
                
                {/* The text labels layer */}
                <View style={styles.textLayer}>
                    <Text style={[styles.text, { color: isTamil ? '#F36F25' : '#fff' }]}>TA</Text>
                    <Text style={[styles.text, { color: isTamil ? '#fff' : '#F36F25' }]}>EN</Text>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 70,
        height: 30,
        backgroundColor: '#F36F25',
        borderRadius: 30,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
    },
    thumb: {
        position: 'absolute',
        top: 3,
        width: 32,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 30,
    },
    textLayer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    text: {
        fontSize: 11,
        fontWeight: 'bold',
        zIndex: 10,
    }
});
