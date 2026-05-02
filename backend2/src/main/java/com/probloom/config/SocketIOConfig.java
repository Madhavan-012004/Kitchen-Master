package com.probloom.config;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.store.MemoryStoreFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PreDestroy;

@Configuration
public class SocketIOConfig {

    private SocketIOServer server;

    @Bean
    public SocketIOServer socketIOServer() {
        com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
        config.setHostname("0.0.0.0");
        config.setPort(9092);
        config.setOrigin("*");
        config.setAllowHeaders("*");
        config.setAllowCustomRequests(true);
        config.setStoreFactory(new MemoryStoreFactory());

        server = new SocketIOServer(config);
        
        // Add listeners
        server.addConnectListener(client -> {
            System.out.println("🔌 Client connected: " + client.getSessionId());
        });

        server.addDisconnectListener(client -> {
            System.out.println("🔌 Client disconnected: " + client.getSessionId());
        });

        server.addEventListener("join:restaurant", String.class, (client, restaurantId, ackRequest) -> {
            client.joinRoom(restaurantId);
            System.out.println("🔌 Client joined room: " + restaurantId);
        });

        try {
            server.start();
        } catch (Exception e) {
            System.err.println("⚠️ Could not start SocketIO server (likely port 9092 in use): " + e.getMessage());
        }
        return server;
    }

    @PreDestroy
    public void stopSocketIOServer() {
        if (server != null) {
            server.stop();
        }
    }
}
