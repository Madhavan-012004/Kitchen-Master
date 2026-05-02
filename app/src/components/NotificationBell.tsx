import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Shadows } from '../theme';
import { useNotificationStore } from '../store/useNotificationStore';
import { NotificationModal } from './NotificationModal';

interface Props {
    color?: string;
    size?: number;
}

export const NotificationBell: React.FC<Props> = ({ color, size = 22 }) => {
    const { colors } = useAppTheme();
    const { unreadCount } = useNotificationStore();
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <>
            <TouchableOpacity 
                style={styles.container} 
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                <Ionicons 
                    name="notifications-outline" 
                    size={size} 
                    color={color || colors.textSecondary} 
                />
                {unreadCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.error }]}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            <NotificationModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 4,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
        borderWidth: 1.5,
        borderColor: 'white', // Creating a cutout effect
        // ...Shadows.sm
    },
    badgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900',
        textAlign: 'center',
    }
});
