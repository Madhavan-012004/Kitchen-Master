package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final CurrentUserResolver resolver;

    /**
     * Reads X-Restaurant-Id header to scope analytics.
     * - OWNER/STAFF: ignores header, uses own restaurant.
     * - STAKEHOLDER with "ALL": aggregates across all accessible restaurants.
     * - STAKEHOLDER with specific ID: returns data for just that restaurant.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        List<User> restaurants = resolver.resolveAllowedRestaurants(xRestaurantId);
        return ok("Analytics fetched", analyticsService.getDashboard(restaurants));
    }

    @GetMapping("/sales")
    public ResponseEntity<?> getSales(
            @RequestParam(value = "period", defaultValue = "7d") String period,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        List<User> restaurants = resolver.resolveAllowedRestaurants(xRestaurantId);
        
        LocalDateTime from = (fromStr != null && !fromStr.isBlank()) ? LocalDateTime.parse(fromStr) : null;
        LocalDateTime to = (toStr != null && !toStr.isBlank()) ? LocalDateTime.parse(toStr) : null;
        
        return ok("Sales analytics fetched", analyticsService.getSalesAnalytics(restaurants, period, from, to));
    }

    @GetMapping("/report-data")
    public ResponseEntity<?> getReportData(
            @RequestParam("type") String type,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        LocalDateTime from = fromStr != null ? LocalDateTime.parse(fromStr) : LocalDateTime.now().minusDays(7);
        LocalDateTime to = toStr != null ? LocalDateTime.parse(toStr) : LocalDateTime.now();
        return ok("Report data fetched", analyticsService.getReportData(type, restaurant, from, to));
    }

    @GetMapping("/download-report")
    public ResponseEntity<byte[]> downloadReport(
            @RequestParam("type") String type,
            @RequestParam(value = "format", defaultValue = "pdf") String format,
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) throws Exception {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        LocalDateTime from = fromStr != null ? LocalDateTime.parse(fromStr) : LocalDateTime.now().minusDays(7);
        LocalDateTime to   = toStr   != null ? LocalDateTime.parse(toStr)   : LocalDateTime.now();

        byte[] data = analyticsService.downloadReport(type, format, restaurant, from, to);

        String contentType;
        String filename;
        switch (format.toLowerCase()) {
            case "word", "docx" -> {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                filename    = type + ".docx";
            }
            case "json" -> {
                contentType = "application/json";
                filename    = type + ".json";
            }
            default -> {
                contentType = "application/pdf";
                filename    = type + ".pdf";
            }
        }

        return ResponseEntity.ok()
                .header("Content-Type", contentType)
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(data);
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
