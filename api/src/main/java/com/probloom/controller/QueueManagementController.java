package com.probloom.controller;

import com.probloom.model.entity.QueueEntry;
import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import com.probloom.service.QueueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/queue")
public class QueueManagementController {

    @Autowired
    private QueueService queueService;

    @Autowired
    private UserRepository userRepository;

    private User getAuthenticatedRestaurant() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = Long.parseLong(auth.getName());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getRole() == User.Role.OWNER ? user : user.getParentOwner();
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveQueue() {
        try {
            User restaurant = getAuthenticatedRestaurant();
            List<QueueEntry> queue = queueService.getActiveQueue(Objects.requireNonNull(restaurant.getId()));
            
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

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable @NonNull Long id,
            @RequestBody UpdateStatusRequest request) {
        
        try {
            User restaurant = getAuthenticatedRestaurant();
            QueueEntry updated = queueService.updateQueueStatus(
                Objects.requireNonNull(restaurant.getId()), 
                Objects.requireNonNull(id), 
                Objects.requireNonNull(request.getStatus()), 
                request.getTableNumber()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", updated);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    public static class UpdateStatusRequest {
        private QueueEntry.QueueStatus status;
        private String tableNumber;

        public QueueEntry.QueueStatus getStatus() { return status; }
        public void setStatus(QueueEntry.QueueStatus status) { this.status = status; }
        public String getTableNumber() { return tableNumber; }
        public void setTableNumber(String tableNumber) { this.tableNumber = tableNumber; }
    }
}
