import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function AIToolsScreen() {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);

    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hello! I am your ProBloom Assistant. How can I help you manage your restaurant today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const sparkleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(sparkleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
                Animated.timing(sparkleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        Keyboard.dismiss();

        const newMsgId = Date.now().toString();
        const newUserMsg: Message = { id: newMsgId, role: 'user', content: userMsg };
        
        setMessages(prev => [...prev, newUserMsg]);
        setLoading(true);
        scrollToBottom();

        try {
            const res = await apiClient.post('/ai/chat', { message: userMsg });
            if (res.data.success) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: res.data.data.response }]);
            } else {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'I am having trouble connecting right now. Please check your connection.' }]);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    const renderMessageContent = (content: string) => {
        // Handle bolding formatting basic parsing for **bold** text
        const parts = content.split(/(\*\*.*?\*\*)/g);
        
        return (
            <Text style={themedStyles.messageText}>
                {parts.map((part, index) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <Text key={index} style={{ fontWeight: 'bold' }}>{part.slice(2, -2)}</Text>;
                    }
                    return part;
                })}
            </Text>
        );
    };

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                
                {/* Header */}
                <View style={themedStyles.header}>
                    <View style={themedStyles.headerLeft}>
                        <Animated.View style={{ opacity: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}>
                            <Ionicons name="sparkles" size={24} color={colors.primary} />
                        </Animated.View>
                        <Text style={themedStyles.headerTitle}>AI Assistant</Text>
                    </View>
                    <View style={themedStyles.badge}>
                        <Text style={themedStyles.badgeText}>Beta</Text>
                    </View>
                </View>

                {/* Chat Area */}
                <ScrollView 
                    ref={scrollViewRef}
                    contentContainerStyle={themedStyles.chatContainer}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToBottom}
                >
                    {messages.map((msg) => (
                        <View key={msg.id} style={[
                            themedStyles.messageWrapper, 
                            msg.role === 'user' ? themedStyles.messageWrapperUser : themedStyles.messageWrapperAssistant
                        ]}>
                            {msg.role === 'assistant' && (
                                <View style={themedStyles.avatarAssistant}>
                                    <Ionicons name="flash" size={16} color={colors.primary} />
                                </View>
                            )}
                            <View style={[
                                themedStyles.messageBubble,
                                msg.role === 'user' ? themedStyles.messageBubbleUser : themedStyles.messageBubbleAssistant
                            ]}>
                                {renderMessageContent(msg.content)}
                            </View>
                        </View>
                    ))}
                    {loading && (
                        <View style={[themedStyles.messageWrapper, themedStyles.messageWrapperAssistant]}>
                            <View style={themedStyles.avatarAssistant}>
                                <Ionicons name="flash" size={16} color={colors.primary} />
                            </View>
                            <View style={[themedStyles.messageBubble, themedStyles.messageBubbleAssistant, { minWidth: 60, alignItems: 'center' }]}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Input Area */}
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={themedStyles.inputContainer}>
                        <TextInput
                            style={themedStyles.textInput}
                            placeholder="Message AI Assistant..."
                            placeholderTextColor={colors.textMuted}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity 
                            style={[themedStyles.sendButton, !input.trim() && { opacity: 0.5 }]} 
                            onPress={handleSend}
                            disabled={!input.trim() || loading}
                        >
                            <Ionicons name="arrow-up" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
                
                {/* Extra padding to prevent bottom tab overlap */}
                <View style={{ height: 90 }} />

            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.card,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    badge: {
        backgroundColor: colors.primary + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    badgeText: { ...Typography.caption, color: colors.primary, fontWeight: 'bold' },
    chatContainer: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: Spacing.lg,
        maxWidth: '85%',
    },
    messageWrapperUser: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
    },
    messageWrapperAssistant: {
        alignSelf: 'flex-start',
    },
    avatarAssistant: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
        marginTop: 2,
    },
    messageBubble: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
    },
    messageBubbleUser: {
        backgroundColor: colors.primary,
        borderTopRightRadius: 4,
    },
    messageBubbleAssistant: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: colors.border,
        ...Shadows.sm,
    },
    messageText: {
        ...Typography.body1,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    textInput: {
        flex: 1,
        minHeight: 45,
        maxHeight: 120,
        backgroundColor: isDark ? colors.surface : '#F3F4F6',
        borderRadius: 22,
        paddingHorizontal: Spacing.lg,
        paddingTop: 12,
        paddingBottom: 12,
        color: colors.textPrimary,
        ...Typography.body1,
        marginRight: Spacing.sm,
    },
    sendButton: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
});
