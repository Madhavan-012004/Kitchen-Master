package com.probloom.controller;

import com.probloom.model.entity.QueueEntry;
import com.probloom.service.QueueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/public/queue")
public class PublicQueueController {

    @Autowired
    private QueueService queueService;

    @PostMapping("/join/{restaurantId}")
    public ResponseEntity<?> joinQueue(
            @PathVariable @NonNull Long restaurantId,
            @RequestBody JoinQueueRequest request) {
        
        try {
            QueueEntry entry = queueService.joinQueue(
                Objects.requireNonNull(restaurantId), 
                request.getCustomerName(), 
                request.getCustomerPhone(), 
                request.getPartySize()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("tokenNumber", entry.getTokenNumber());
            response.put("message", "Successfully joined the waitlist");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/active/{restaurantId}")
    public ResponseEntity<?> getActiveQueue(@PathVariable @NonNull Long restaurantId) {
        try {
            List<QueueEntry> queue = queueService.getActiveQueue(Objects.requireNonNull(restaurantId));
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", queue);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    public static class JoinQueueRequest {
        private String customerName;
        private String customerPhone;
        private Integer partySize;

        // Getters and Setters
        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }
        public String getCustomerPhone() { return customerPhone; }
        public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
        public Integer getPartySize() { return partySize; }
        public void setPartySize(Integer partySize) { this.partySize = partySize; }
    }

    @GetMapping("/status/{restaurantId}/{tokenNumber}")
    public ResponseEntity<?> getTokenStatus(
            @PathVariable @NonNull Long restaurantId,
            @PathVariable String tokenNumber) {
        try {
            List<QueueEntry> queue = queueService.getActiveQueue(Objects.requireNonNull(restaurantId));
            QueueEntry entry = queue.stream()
                .filter(q -> q.getTokenNumber().equalsIgnoreCase(tokenNumber))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Token not found or no longer active"));
                
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", entry);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
