package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.service.StakeholderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.NonNull;

/**
 * REST controller for the Stakeholder multi-tenancy feature.
 *
 * Owner-facing endpoints:
 *  POST   /api/stakeholder/invite          → invite a new stakeholder by phone
 *  DELETE /api/stakeholder/{id}            → remove a stakeholder from your restaurant
 *  GET    /api/stakeholder/list            → list all your restaurant's stakeholders
 *
 * Stakeholder-facing endpoints:
 *  POST   /api/stakeholder/login           → phone + password login (returns restaurant list)
 *  GET    /api/stakeholder/restaurants     → list all restaurants accessible to logged-in stakeholder
 */
@RestController
@RequestMapping("/api/stakeholder")
@RequiredArgsConstructor
public class StakeholderController {

    private final StakeholderService stakeholderService;
    private final CurrentUserResolver resolver;

    // ── Stakeholder Login ────────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> stakeholderLogin(@RequestBody Map<String, Object> body) {
        String phone = (String) body.get("phone");
        String password = (String) body.get("password");
        Map<String, Object> data = stakeholderService.stakeholderLogin(phone, password);
        return ok("Stakeholder login successful", data);
    }

    // ── Stakeholder: list their accessible restaurants ───────────────────────

    @GetMapping("/restaurants")
    public ResponseEntity<?> getAccessibleRestaurants() {
        User stakeholder = resolver.getCurrentUser();
        if (stakeholder.getRole() != User.Role.STAKEHOLDER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only stakeholders can access this endpoint."));
        }
        return ok("Accessible restaurants fetched", Map.of("restaurants", stakeholderService.getAccessibleRestaurants(stakeholder)));
    }

    // ── Owner: invite stakeholder ─────────────────────────────────────────────

    @PostMapping("/invite")
    public ResponseEntity<?> inviteStakeholder(@RequestBody Map<String, Object> body) {
        User owner = resolver.getRestaurantOwner();
        if (owner.getRole() != User.Role.OWNER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only restaurant owners can invite stakeholders."));
        }
        String phone = (String) body.get("phone");
        String name = (String) body.get("name");
        String password = (String) body.get("password");
        Double sharePercentage = body.get("sharePercentage") != null
                ? Double.valueOf(body.get("sharePercentage").toString()) : 0.0;

        Map<String, Object> result = stakeholderService.inviteStakeholder(owner, phone, name, password, sharePercentage);
        return ok("Stakeholder invited successfully", result);
    }

    // ── Owner: remove stakeholder ─────────────────────────────────────────────

    @DeleteMapping("/{stakeholderId}")
    public ResponseEntity<?> removeStakeholder(@PathVariable("stakeholderId") @NonNull Long stakeholderId) {
        User owner = resolver.getRestaurantOwner();
        if (owner.getRole() != User.Role.OWNER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only restaurant owners can remove stakeholders."));
        }
        stakeholderService.removeStakeholder(owner, Objects.requireNonNull(stakeholderId));
        return ok("Stakeholder removed from your restaurant", null);
    }

    // ── Owner: list all stakeholders for their restaurant ────────────────────

    @GetMapping("/list")
    public ResponseEntity<?> listStakeholders() {
        User owner = resolver.getRestaurantOwner();
        if (owner.getRole() != User.Role.OWNER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only restaurant owners can list stakeholders."));
        }
        return ok("Stakeholders fetched", Map.of("stakeholders", stakeholderService.getRestaurantStakeholders(owner)));
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
