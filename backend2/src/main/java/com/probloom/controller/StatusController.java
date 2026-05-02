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

    @GetMapping
    public ResponseEntity<?> getStatus() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "message", "Kitchen Master Backend is connected and running.",
            "timestamp", LocalDateTime.now().toString(),
            "environment", "Java Spring Boot"
        ));
    }
}
