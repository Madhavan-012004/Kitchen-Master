package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.TailoringJob;
import com.probloom.model.entity.TailoringJob.TailoringStatus;
import com.probloom.model.entity.User;
import com.probloom.service.TailoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tailoring")
@RequiredArgsConstructor
public class TailoringController {

    private final TailoringService tailoringService;
    private final CurrentUserResolver resolver;

    @GetMapping("/jobs")
    public ResponseEntity<?> getJobs(@RequestParam(value = "status", required = false) String status) {
        try {
            User restaurant = resolver.getRestaurantOwner();
            List<TailoringJob> jobs;
            if (status != null && !status.isBlank()) {
                jobs = tailoringService.getJobsByStatus(restaurant, TailoringStatus.valueOf(status.toUpperCase()));
            } else {
                jobs = tailoringService.getAllJobs(restaurant);
            }
            return ok("Tailoring jobs fetched", jobs);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Error: " + e.getMessage(), "stacktrace", java.util.Arrays.toString(e.getStackTrace())));
        }
    }

    @PostMapping("/jobs")
    public ResponseEntity<?> createJob(@RequestBody Map<String, Object> body) {
        User user = resolver.getCurrentUser();
        User restaurant = resolver.getRestaurantOwner();
        return ok("Tailoring job created", tailoringService.createJob(restaurant, user, body));
    }

    @GetMapping("/jobs/{id}")
    public ResponseEntity<?> getJob(@PathVariable("id") Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Tailoring job fetched", tailoringService.getJobById(id, restaurant));
    }

    @GetMapping("/jobs/token/{token}")
    public ResponseEntity<?> getByToken(@PathVariable("token") String token) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Tailoring job fetched", tailoringService.getJobByToken(restaurant, token));
    }

    @GetMapping("/jobs/phone/{phone}")
    public ResponseEntity<?> getByPhone(@PathVariable("phone") String phone) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Customer jobs fetched", tailoringService.getJobsByPhone(restaurant, phone));
    }

    @PatchMapping("/jobs/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("id") Long id,
                                          @RequestBody Map<String, String> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Status updated", tailoringService.updateStatus(id, restaurant, body.get("status")));
    }

    @PatchMapping("/jobs/{id}/deliver")
    public ResponseEntity<?> deliver(@PathVariable("id") Long id,
                                     @RequestBody(required = false) Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Job delivered", tailoringService.deliverJob(id, restaurant, body));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Tailoring stats fetched", tailoringService.getStats(restaurant));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
