package com.probloom.controller;

import com.probloom.service.LicenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/license")
public class LicenseController {

    @Autowired
    private LicenseService licenseService;

    /**
     * GET /api/license/status
     * Returns the current license status for this machine.
     * Publicly accessible so the frontend can check status even when not fully authenticated.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = licenseService.getLicenseStatus();
        return ResponseEntity.ok(status);
    }

    /**
     * GET /api/license/generate-request
     * Generates the machine.req data that the customer needs to send to ProBloom HQ.
     * The frontend will trigger a download of this JSON content as machine.req
     */
    @PostMapping("/generate-request")
    public ResponseEntity<Map<String, Object>> generateRequest(@RequestBody Map<String, Object> customerDetails) {
        Map<String, Object> requestData = licenseService.generateLicenseRequest(customerDetails);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "License request generated. Download this file and email it to ProBloom HQ.");
        response.put("requestData", requestData);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/license/upload
     * Accepts a .lic file upload from the admin UI.
     * Validates and saves it to the server root.
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadLicense(@RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> newStatus = licenseService.uploadLicense(file);
            Map<String, Object> response = new HashMap<>();

            if (Boolean.TRUE.equals(newStatus.get("valid"))) {
                response.put("success", true);
                response.put("message", "License activated successfully! Your system is now unlocked.");
            } else {
                response.put("success", false);
                response.put("message", "License file was saved, but validation failed: " + newStatus.get("message"));
            }
            response.put("status", newStatus);
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "Failed to upload license: " + e.getMessage());
            return ResponseEntity.internalServerError().body(err);
        }
    }
}
