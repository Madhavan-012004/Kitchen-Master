package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.lang.NonNull;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CurrentUserResolver resolver;
    private final com.probloom.repository.UserRepository userRepository;
    private final com.probloom.service.FileStorageService fileStorageService;

    @PostMapping("/profile/logo")
    public ResponseEntity<?> uploadLogo(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        User user = resolver.getCurrentUser();
        if (user.getRole() != User.Role.OWNER && user.getRole() != User.Role.MANAGER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only Owners and Managers can change the logo"));
        }
        String fileName = fileStorageService.storeFile(file);
        User updated = authService.updateLogo(Objects.requireNonNull(user.getId()), fileName);
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("user", authService.sanitizeUser(updated));
        return ok("Logo uploaded successfully", data);
    }

    @GetMapping("/public/{id}")
    public ResponseEntity<?> getPublicProfile(@PathVariable("id") String idStr) {
        try {
            Long id = Long.valueOf(idStr);
            User user = userRepository.findById(Objects.requireNonNull(id))
                    .orElseThrow(() -> new com.probloom.exception.ResourceNotFoundException("Restaurant not found (ID: " + id + ")"));
            return ok("Restaurant info fetched", authService.sanitizeUser(user));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid ID format"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @NonNull Map<String, Object> body) {
        Map<String, Object> data = authService.register(
                (String) body.get("name"),
                (String) body.get("email"),
                (String) body.get("password"),
                (String) body.get("restaurantName"),
                (String) body.get("phone"),
                (String) body.get("address"),
                body.get("latitude") != null ? Double.valueOf(body.get("latitude").toString()) : null,
                body.get("longitude") != null ? Double.valueOf(body.get("longitude").toString()) : null,
                (String) body.get("businessType"),
                (String) body.get("requestedPlan"),
                (String) body.get("outletsCount")
        );
        return ok("Registered successfully", data);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @NonNull Map<String, Object> body) {
        Map<String, Object> data = authService.login((String) body.get("email"), (String) body.get("password"));
        return ok("Login successful", data);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getProfile() {
        User user = resolver.getCurrentUser();
        return ok("Profile fetched", authService.sanitizeUser(user));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody @NonNull Map<String, Object> body) {
        User user = resolver.getCurrentUser();
        User updated = authService.updateProfile(Objects.requireNonNull(user.getId()), body);
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("user", authService.sanitizeUser(updated));
        return ok("Profile updated", data);
    }

    @PostMapping("/onboarding")
    public ResponseEntity<?> completeOnboarding(@RequestBody @NonNull Map<String, Object> body) {
        User user = resolver.getCurrentUser();
        // Jackson might deserialize as Integer or Double
        Integer step = body.get("step") != null ? Integer.valueOf(body.get("step").toString()) : null;
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) body.get("data");
        User updated = authService.completeOnboarding(Objects.requireNonNull(user.getId()), step, data);
        return ok("Onboarding step " + step + " completed", authService.sanitizeUser(updated));
    }

    // --- Staff Management (owner only) ---
    @GetMapping({"/users", "/employees"})
    public ResponseEntity<?> getStaff(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User owner = resolver.resolveSingleRestaurant(xRestaurantId);
        List<User> staff = authService.getStaff(owner);
        return ok("Staff fetched", Map.of("employees", staff.stream().map(authService::sanitizeUser).collect(java.util.stream.Collectors.toList())));
    }

    @PostMapping({"/users", "/employee/register"})
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> addStaff(@RequestBody @NonNull Map<String, Object> body) {
        User owner = resolver.getRestaurantOwner();
        User staff = authService.addStaff(owner,
                (String) body.get("name"),
                (String) body.get("email"),
                (String) body.get("password"),
                (String) body.get("role"),
                (List<String>) body.get("assignedTables"));
        return ok("Staff added", authService.sanitizeUser(staff));
    }

    @PutMapping({"/users/{id}", "/employee/{id}"})
    public ResponseEntity<?> updateStaff(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User owner = resolver.getRestaurantOwner();
        User updated = authService.updateStaff(owner, id, body);
        return ok("Staff updated", authService.sanitizeUser(updated));
    }

    @DeleteMapping({"/users/{id}", "/employee/{id}", "/{id}"})
    public ResponseEntity<?> deleteStaff(@PathVariable("id") @NonNull Long id) {
        User owner = resolver.getRestaurantOwner();
        authService.deleteStaff(owner, id);
        return ok("Staff removed", null);
    }

    @PostMapping("/direct-login")
    public ResponseEntity<?> directLogin(@RequestBody @NonNull Map<String, Object> body) {
        Map<String, Object> data = authService.firebaseLogin((String) body.get("phone"));
        return ok("Direct login successful", data);
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
