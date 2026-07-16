package com.probloom.controller;

import com.probloom.service.DatabaseBackupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DatabaseBackupService backupService;

    @PostMapping("/database/export")
    public ResponseEntity<?> exportDatabase() {
        try {
            String fileName = backupService.exportDatabase("manual_export");
            return ok("Database exported successfully", Map.of("fileName", fileName));
        } catch (Exception e) {
            return error("Failed to export database: " + e.getMessage());
        }
    }

    @GetMapping("/database/backups")
    public ResponseEntity<?> getBackups() {
        return ok("Backups fetched", backupService.listBackups());
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> error(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message);
        return ResponseEntity.status(500).body(body);
    }
}
