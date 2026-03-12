import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl } from '../config/api';
import { useAuthStore } from '../store/useAuthStore';
import Toast from 'react-native-toast-message';

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const { user, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && user) {
            let isMounted = true;

            (async () => {
                const socketUrl = await getServerBaseUrl();

                if (!isMounted) return;

                // Initialize socket with dynamically resolved URL
                socketRef.current = io(socketUrl, {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 2000,
                });

                socketRef.current.on('connect', () => {
                    const restaurantId = user.parentOwnerId || user._id;
                    console.log('🔌 Connected to KOT Socket:', socketUrl, 'Room:', restaurantId);
                    socketRef.current?.emit('join:restaurant', restaurantId);
                });

                socketRef.current.on('connect_error', (err) => {
                    console.warn('⚠️ Socket connection error:', err.message);
                });

                // Listen for new KOTs
                socketRef.current.on('kot:new', (data) => {
                    Toast.show({
                        type: 'success',
                        text1: '🍳 New Order Received',
                        text2: `Order #${data.order.orderNumber} is now in queue.`,
                        position: 'top',
                    });
                });

                // Listen for status updates
                socketRef.current.on('kot:statusUpdate', (data) => {
                    Toast.show({
                        type: 'info',
                        text1: '🥘 Status Update',
                        text2: `Order #${data.orderNumber} is now ${data.status.toUpperCase()}`,
                    });
                });
            })();

            return () => {
                isMounted = false;
                socketRef.current?.disconnect();
            };
        }
    }, [isAuthenticated, user]);

    return socketRef.current;
};
