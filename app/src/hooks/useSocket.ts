import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl } from '../config/api';
import { useAuthStore } from '../store/useAuthStore';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const { user, isAuthenticated } = useAuthStore();
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (isAuthenticated && user) {
            let isMounted = true;

            (async () => {
                const base = await getServerBaseUrl();
                const socketUrl = base.replace(':8080', ':9092');
                
                if (!isMounted) return;

                // Initialize socket with dedicated port 9092 (Netty-SocketIO)
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

                // Listen for new Items Ready
                socketRef.current.on('kot:itemsReady', (data) => {
                    // Only alert the specific waiter or an admin
                    const isWaiter = Number(data.waiterId) === Number(user?._id);
                    const isAdmin = user?.role === 'owner' || user?.role === 'manager';
                    
                    if (isWaiter || isAdmin) {
                        Toast.show({
                            type: 'success',
                            text1: `🔔 Food Ready: ${data.tableNumber === 'Takeaway' ? 'Takeaway' : 'Table ' + data.tableNumber}`,
                            text2: `${data.itemsText} ready for #${data.orderNumber}`,
                            position: 'top',
                            visibilityTime: 4000,
                            onPress: () => {
                                Toast.hide();
                                if (data.orderId && data.orderId !== -1) {
                                    navigation.navigate('Checkout', { orderId: data.orderId });
                                }
                            }
                        });
                    }
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
