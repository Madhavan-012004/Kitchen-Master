package com.probloom.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/status")
public class StatusController {

    @org.springframework.beans.factory.annotation.Autowired
    private javax.sql.DataSource dataSource;

    // Cache the last DB check result so health polls don't hammer the DB
    private final AtomicBoolean lastDbOk = new AtomicBoolean(true);
    private final AtomicLong lastDbCheckTime = new AtomicLong(0);
    private static final long DB_CHECK_INTERVAL_MS = 15_000; // re-check DB every 15s max

    /**
     * GET /api/status — Full health check with DB validation.
     * Used by the frontend health poll loop.
     */
    @GetMapping
    public ResponseEntity<?> getStatus() {
        boolean dbOk = checkDbWithCache();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", dbOk ? "UP" : "DOWN");
        body.put("db", dbOk ? "OK" : "ERROR");
        body.put("message", dbOk
            ? "ProBloom Backend is connected and running."
            : "Database connection failed — backend running but DB unreachable.");
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("environment", "Java Spring Boot");

        return dbOk
            ? ResponseEntity.ok(body)
            : ResponseEntity.status(503).body(body);
    }

    /**
     * GET /api/status/ping — Ultra-fast liveness check (no DB query).
     * Use this for rapid keep-alive pings from clients.
     */
    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok(Map.of(
            "pong", true,
            "ts", System.currentTimeMillis()
        ));
    }

    /**
     * Checks DB connectivity with a result cache to avoid excessive connections.
     * Re-checks at most every DB_CHECK_INTERVAL_MS milliseconds.
     */
    private boolean checkDbWithCache() {
        long now = System.currentTimeMillis();
        long last = lastDbCheckTime.get();

        // Use cached result if checked recently
        if (now - last < DB_CHECK_INTERVAL_MS && last > 0) {
            return lastDbOk.get();
        }

        // Perform actual DB check
        boolean ok = false;
        try (java.sql.Connection conn = dataSource.getConnection()) {
            ok = conn.isValid(2);
        } catch (Exception e) {
            ok = false;
        }

        lastDbOk.set(ok);
        lastDbCheckTime.set(now);
        return ok;
    }
}
