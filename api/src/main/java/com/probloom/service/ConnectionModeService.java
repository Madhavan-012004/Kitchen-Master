package com.probloom.service;

import com.probloom.config.DataSourceModeHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service that manages the active database connection mode (online / offline).
 * Called by ConnectionModeController via the REST API, and by the login flow.
 */
@Service
public class ConnectionModeService {

    private static final Logger log = LoggerFactory.getLogger(ConnectionModeService.class);

    /**
     * Switches the global database connection mode.
     * @param mode "online" or "offline"
     */
    public Map<String, Object> setMode(String mode) {
        String normalized = mode.toLowerCase().trim();
        DataSourceModeHolder.setMode(normalized);
        log.info("[ConnectionMode] Switched to: {}", normalized);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("mode", normalized);
        result.put("message", "offline".equals(normalized)
                ? "Switched to local offline database."
                : "Switched to cloud online database.");
        return result;
    }

    /**
     * Returns the current active mode and connection info.
     */
    public Map<String, Object> getStatus() {
        String mode = DataSourceModeHolder.getMode();
        Map<String, Object> status = new HashMap<>();
        status.put("mode", mode);
        status.put("isOffline", DataSourceModeHolder.isOffline());
        status.put("description", DataSourceModeHolder.isOffline()
                ? "Using local embedded database (offline mode)"
                : "Using cloud PostgreSQL database (online mode)");
        return status;
    }
}
