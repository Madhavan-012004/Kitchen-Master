package com.probloom.service;

import com.corundumstudio.socketio.SocketIOServer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SocketService {

    private final SocketIOServer server;

    public void broadcastToRestaurant(Long restaurantId, String event, Object data) {
        String room = String.valueOf(restaurantId);
        server.getRoomOperations(room).sendEvent(event, data);
        System.out.println("🔌 Broadcasted event '" + event + "' to restaurant " + restaurantId);
    }

    public void broadcastToTable(Long restaurantId, String tableNumber, String event, Object data) {
        String room = "table-" + restaurantId + "-" + tableNumber;
        server.getRoomOperations(room).sendEvent(event, data);
        System.out.println("🔌 Broadcasted event '" + event + "' to table " + tableNumber + " at restaurant " + restaurantId);
    }

    public void broadcastNewKOT(Long restaurantId, Object orderData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("order", orderData);
        broadcastToRestaurant(restaurantId, "kot:new", payload);
    }

    public void broadcastKOTUpdate(Long restaurantId, Object orderData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("order", orderData);
        broadcastToRestaurant(restaurantId, "kot:update", payload);
    }

    public void broadcastStatusUpdate(Long restaurantId, Long orderId, String orderNumber, String status, String tableNumber) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", orderId != null ? orderId : -1L);
        payload.put("orderNumber", orderNumber != null ? orderNumber : "");
        payload.put("status", status != null ? status : "");
        broadcastToRestaurant(restaurantId, "kot:statusUpdate", payload);
        
        if (tableNumber != null && !tableNumber.isEmpty()) {
            broadcastToTable(restaurantId, tableNumber, "kot:statusUpdate", payload);
        }
    }

    public void broadcastItemsReady(Long restaurantId, Long orderId, Long waiterId, String orderNumber, String tableNumber, String itemsText) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", orderId != null ? orderId : -1L);
        payload.put("waiterId", waiterId != null ? waiterId : -1L);
        payload.put("orderNumber", orderNumber != null ? orderNumber : "");
        payload.put("tableNumber", tableNumber != null ? tableNumber : "Takeaway");
        payload.put("itemsText", itemsText != null ? itemsText : "");
        broadcastToRestaurant(restaurantId, "kot:itemsReady", payload);
    }

    public void broadcastItemStatusUpdate(Long restaurantId, Long orderId, Long itemId, String status, String orderStatus, String tableNumber) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", orderId);
        payload.put("itemId", itemId);
        payload.put("status", status != null ? status : "");
        payload.put("orderStatus", orderStatus != null ? orderStatus : "");
        broadcastToRestaurant(restaurantId, "kot:itemUpdate", payload);
        
        if (tableNumber != null && !tableNumber.isEmpty()) {
            broadcastToTable(restaurantId, tableNumber, "kot:itemUpdate", payload);
        }
    }

    public void broadcastWaiterRequest(Long restaurantId, Object orderData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("order", orderData);
        broadcastToRestaurant(restaurantId, "waiter:newOrderRequest", payload);
    }

    public void broadcastWaiterAcknowledged(Long restaurantId, Long orderId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", orderId);
        broadcastToRestaurant(restaurantId, "waiter:orderAcknowledged", payload);
    }

    public void broadcastBillingRequest(Long restaurantId, Object orderData) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("order", orderData);
        broadcastToRestaurant(restaurantId, "billing:newRequest", payload);
    }

    public void broadcastBillingPrinted(Long restaurantId, Long orderId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", orderId);
        broadcastToRestaurant(restaurantId, "billing:printed", payload);
    }

    public void broadcastNotification(Long restaurantId, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", message);
        broadcastToRestaurant(restaurantId, "notification:send", payload);
    }
}

