package com.probloom.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/status")
public class StatusController {

    @org.springframework.beans.factory.annotation.Autowired
    private javax.sql.DataSource dataSource;

    @GetMapping
    public ResponseEntity<?> getStatus() {
        boolean dbOk = false;
        try (java.sql.Connection conn = dataSource.getConnection()) {
            dbOk = conn.isValid(2);
        } catch (Exception e) {
            dbOk = false;
        }

        if (!dbOk) {
            return ResponseEntity.status(500).body(Map.of(
                "status", "DOWN",
                "message", "Database connection failed",
                "timestamp", LocalDateTime.now().toString()
            ));
        }

        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "message", "ProBloom Backend is connected and running.",
            "timestamp", LocalDateTime.now().toString(),
            "environment", "Java Spring Boot"
        ));
    }
}
