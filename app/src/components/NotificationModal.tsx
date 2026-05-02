import React from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    FlatList, Pressable, Platform, Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, Typography, Spacing, Radius } from '../theme';
import { useNotificationStore, Notification } from '../store/useNotificationStore';
import { formatDistanceToNow } from 'date-fns';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const NotificationModal: React.FC<Props> = ({ visible, onClose }) => {
    const { colors, isDark } = useAppTheme();
    const { notifications, markAllAsRead, clearAll } = useNotificationStore();

    const renderItem = ({ item }: { item: Notification }) => (
        <View style={[styles.notificationCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={styles.cardHeader}>
                <View style={[styles.unreadDot, item.isRead && { opacity: 0 }]} />
                <Text style={styles.timeText}>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</Text>
            </View>
            <Text style={styles.messageText}>{item.message}</Text>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                
                <Pressable style={[styles.modalContainer, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Notifications</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {notifications.length > 0 ? (
                        <>
                            <FlatList
                                data={notifications}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                            />
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.footerBtn} onPress={markAllAsRead}>
                                    <Text style={[styles.footerBtnText, { color: colors.primary }]}>Mark all as read</Text>
                                </TouchableOpacity>
                                <View style={styles.divider} />
                                <TouchableOpacity style={styles.footerBtn} onPress={clearAll}>
                                    <Text style={[styles.footerBtnText, { color: colors.error }]}>Clear all</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContainer: {
        width: '100%',
        maxHeight: '70%',
        borderRadius: Radius.xl,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128,128,128,0.1)',
    },
    title: {
        ...Typography.h3,
    },
    closeBtn: {
        padding: 4,
    },
    listContent: {
        padding: Spacing.md,
    },
    notificationCard: {
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#C6F53D',
    },
    timeText: {
        ...Typography.caption,
        color: 'gray',
    },
    messageText: {
        ...Typography.body2,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(128,128,128,0.1)',
        paddingVertical: Spacing.sm,
    },
    footerBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    footerBtnText: {
        ...Typography.buttonSm,
        fontWeight: '700',
    },
    divider: {
        width: 1,
        height: '60%',
        backgroundColor: 'rgba(128,128,128,0.2)',
        alignSelf: 'center',
    },
    emptyContainer: {
        padding: Spacing.xl * 2,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        ...Typography.body2,
        color: 'gray',
    },
});
