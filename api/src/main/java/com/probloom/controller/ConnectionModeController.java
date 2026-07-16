package com.probloom.controller;

import com.probloom.service.ConnectionModeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for switching between online (cloud) and offline (embedded) database modes.
 *
 * Endpoints:
 *   GET  /api/config/mode         → returns current mode
 *   POST /api/config/mode         → switches mode { "mode": "online" | "offline" }
 */
@RestController
@RequestMapping("/api/config")
public class ConnectionModeController {

    @Autowired
    private ConnectionModeService connectionModeService;

    @GetMapping("/mode")
    public ResponseEntity<Map<String, Object>> getMode() {
        return ResponseEntity.ok(connectionModeService.getStatus());
    }

    @PostMapping("/mode")
    public ResponseEntity<Map<String, Object>> setMode(@RequestBody Map<String, Object> body) {
        try {
            Object modeObj = body.get("mode");
            if (modeObj == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Missing 'mode' field. Expected 'online' or 'offline'."
                ));
            }
            Map<String, Object> result = connectionModeService.setMode(modeObj.toString());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }
}
