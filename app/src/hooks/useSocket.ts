import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl } from '../config/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNetworkStore } from '../store/useNetworkStore';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

// Singleton socket — shared across all hook callers in the same session
let _socket: Socket | null = null;
let _socketUrl: string | null = null;
let _restaurantId: string | null = null;

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const { user, isAuthenticated } = useAuthStore();
    const { setOnline } = useNetworkStore();
    const navigation = useNavigation<any>();

    // Stable join function — emitted on every (re)connect
    const joinRoom = useCallback((socket: Socket, rid: string) => {
        socket.emit('join:restaurant', rid);
        console.log('🔌 Joined socket room:', rid);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            // Disconnect when user logs out
            if (_socket) {
                _socket.disconnect();
                _socket = null;
                _socketUrl = null;
            }
            return;
        }

        let isMounted = true;

        (async () => {
            const base = await getServerBaseUrl();
            const socketUrl = base.replace(':8080', ':9092');
            const restaurantId = user.parentOwnerId || user._id;

            if (!isMounted) return;

            // Reuse existing socket if same URL and room
            if (_socket && _socketUrl === socketUrl && _restaurantId === restaurantId) {
                socketRef.current = _socket;
                if (!_socket.connected) _socket.connect();
                return;
            }

            // Clean up old socket before creating new one
            if (_socket) {
                _socket.removeAllListeners();
                _socket.disconnect();
            }

            console.log('🔌 Connecting socket to:', socketUrl);

            _socket = io(socketUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity,        // never give up
                reconnectionDelay: 1000,               // start at 1s
                reconnectionDelayMax: 10000,           // cap at 10s
                randomizationFactor: 0.3,              // add jitter to avoid thundering herd
                timeout: 10000,                        // connection timeout
                autoConnect: true,
            });

            _socketUrl = socketUrl;
            _restaurantId = restaurantId;
            socketRef.current = _socket;

            _socket.on('connect', () => {
                console.log('✅ Socket connected, ID:', _socket?.id);
                joinRoom(_socket!, restaurantId);
                // Mark app as online when socket connects
                setOnline();
            });

            _socket.on('reconnect', (attempt: number) => {
                console.log(`🔄 Socket reconnected after ${attempt} attempt(s)`);
                joinRoom(_socket!, restaurantId);
                setOnline();
            });

            _socket.on('reconnect_attempt', (attempt: number) => {
                console.log(`⏳ Socket reconnect attempt #${attempt}...`);
            });

            _socket.on('connect_error', (err) => {
                console.warn('⚠️ Socket connect_error:', err.message);
            });

            _socket.on('disconnect', (reason) => {
                console.warn('🔌 Socket disconnected. Reason:', reason);
                // socket.io will auto-reconnect for all reasons except 'io server disconnect'
                if (reason === 'io server disconnect') {
                    _socket?.connect(); // re-initiate manually if server kicked us
                }
            });

            // ── KOT Events ─────────────────────────────────────────────────────────

            _socket.on('kot:new', (data: any) => {
                Toast.show({
                    type: 'success',
                    text1: '🍳 New Order Received',
                    text2: `Order #${data.order?.orderNumber} is now in queue.`,
                    position: 'top',
                    visibilityTime: 4000,
                });
            });

            _socket.on('kot:statusUpdate', (data: any) => {
                Toast.show({
                    type: 'info',
                    text1: '🥘 Order Status Update',
                    text2: `Order #${data.orderNumber} is now ${data.status?.toUpperCase()}`,
                    position: 'top',
                    visibilityTime: 3000,
                });
            });

            _socket.on('kot:itemsReady', (data: any) => {
                const isWaiter = Number(data.waiterId) === Number(user?._id);
                const isAdmin = user?.role === 'owner' || user?.role === 'manager';

                if (isWaiter || isAdmin) {
                    Toast.show({
                        type: 'success',
                        text1: `🔔 Food Ready: ${data.tableNumber === 'Takeaway' ? 'Takeaway' : 'Table ' + data.tableNumber}`,
                        text2: `${data.itemsText} ready for #${data.orderNumber}`,
                        position: 'top',
                        visibilityTime: 5000,
                        onPress: () => {
                            Toast.hide();
                            if (data.orderId && data.orderId !== -1) {
                                navigation.navigate('Checkout', { orderId: data.orderId });
                            }
                        },
                    });
                }
            });

            _socket.on('notification:send', (data: any) => {
                if (data.message) {
                    Toast.show({
                        type: 'info',
                        text1: '🔔 Notification',
                        text2: data.message,
                        position: 'top',
                    });
                }
            });
        })();

        return () => {
            isMounted = false;
            // Do NOT disconnect the singleton on unmount — let it persist across re-renders
        };
    }, [isAuthenticated, user?._id]);

    return socketRef.current;
};
