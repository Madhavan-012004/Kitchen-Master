package com.probloom.controller;

import com.probloom.service.MasterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/master/clients")
public class MasterController {

    @Autowired
    private MasterService masterService;

    @NonNull
    private Long getAdminId(Authentication auth) {
        return Objects.requireNonNull(Long.parseLong(auth.getName()));
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }

    @GetMapping
    public ResponseEntity<?> getClients(Authentication auth, @RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String licenseType) {
        return ok("Fetched clients", masterService.getClientsAndStats(getAdminId(auth), search, status, licenseType));
    }

    @PostMapping("/digital")
    public ResponseEntity<?> createDigitalClient(Authentication auth, @RequestBody @NonNull Map<String, Object> req) {
        return ok("Digital client created", masterService.createClient(getAdminId(auth), req, "digital"));
    }

    @PostMapping("/prime")
    public ResponseEntity<?> createPrimeClient(Authentication auth, @RequestBody @NonNull Map<String, Object> req) {
        return ok("Prime client created", masterService.createClient(getAdminId(auth), req, "prime"));
    }

    @PutMapping("/{id}/renew")
    public ResponseEntity<?> renewClient(Authentication auth, @PathVariable @NonNull Long id) {
        return ok("Client renewed", masterService.renewClient(getAdminId(auth), id));
    }

    @PostMapping("/{id}/generate-license")
    public ResponseEntity<?> generateLicense(Authentication auth, @PathVariable @NonNull Long id) {
        return ok("License generated", masterService.generateLicense(getAdminId(auth), id));
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<?> toggleStatus(Authentication auth, @PathVariable @NonNull Long id) {
        return ok("Status toggled", masterService.toggleStatus(getAdminId(auth), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteClient(Authentication auth, @PathVariable @NonNull Long id) {
        masterService.deleteClient(getAdminId(auth), id);
        return ok("Client deleted permanently", null);
    }
}

