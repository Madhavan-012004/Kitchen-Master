package com.probloom.controller;

import com.probloom.service.MasterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.lang.NonNull;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/master/banners")
public class MaintenanceBannerController {

    @Autowired
    private MasterService masterService;

    @NonNull
    private Long getAdminId(Authentication auth) {
        if (auth == null || auth.getName() == null)
            return -1L;
        try {
            return Long.parseLong(auth.getName());
        } catch (NumberFormatException e) {
            return -1L;
        }
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null)
            body.put("data", data);
        return ResponseEntity.ok(body);
    }

    // --- Admin Endpoints ---

    @GetMapping
    public ResponseEntity<?> listBanners(Authentication auth) {
        return ok("Banners listed", masterService.listBanners(getAdminId(auth)));
    }

    @PostMapping
    public ResponseEntity<?> createBanner(Authentication auth, @RequestBody Map<String, Object> req) {
        return ok("Banner created", masterService.createBanner(getAdminId(auth), req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBanner(Authentication auth, @PathVariable Long id) {
        masterService.deleteBanner(getAdminId(auth), id);
        return ok("Banner deleted", null);
    }

    // --- Public Endpoint ---

    @GetMapping("/active")
    public ResponseEntity<?> getActiveBanner() {
        return ok("Active banner fetched", masterService.getActiveBanner().orElse(null));
    }
}
