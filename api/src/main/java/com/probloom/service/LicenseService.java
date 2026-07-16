package com.probloom.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.probloom.util.HardwareUtil;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Objects;
import java.util.Optional;

@Service
public class LicenseService {

    // RSA Public Key (matches the private key in hq_tools/keys/private.pem)
    // This key is used to verify that the .lic file was genuinely signed by ProBloom HQ.
    private static final String PUBLIC_KEY_PEM =
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4NnQj4jJE6OefgcxeY+s" +
        "F4sC2Env+SBbxJdDXIV1l2S4iLjJGU4I4AvCdcC425BEOyeVnxSQzofta84PKJV5" +
        "AdVw1SV6Meo/NNgSKOXs86iQHLS+ecMfifyb6Iq0oOSO//zp7EmMX3AYMp7bHLsa" +
        "kbLmH1z+1dzGq21dRMyUD1A10tk0StWi3ZNf8jaC3rkzIlvzv78o+uhkUwnzRIEm" +
        "RMxdk1qs2cLjXRMvC0ZiPia8Ryy+qeDdNe/7D/m695ArA7ntV0O5J56h2UxDHXtB" +
        "6chMztKnzfO9AF9w2kgzbx08WUQdcZ+/8+1j5a/x72emgphI/7mW3bRsu0DMUiN8" +
        "PwIDAQAB";

    // ── License file path ──────────────────────────────────────────────────────
    // In standalone (EXE) mode: %APPDATA%\ProBloom\license.lic
    // In dev mode: ./license.lic (working directory)
    private static String getLicenseFilePath() {
        boolean isStandalone = "true".equalsIgnoreCase(System.getProperty("STANDALONE"))
                || "true".equalsIgnoreCase(System.getenv("STANDALONE"));
        if (isStandalone) {
            String appData = System.getenv("APPDATA");
            if (appData != null && !appData.isEmpty()) {
                java.io.File dir = new java.io.File(appData, "ProBloom");
                dir.mkdirs();
                return new java.io.File(dir, "license.lic").getAbsolutePath();
            }
            // Fallback: ~/.probloom/license.lic
            java.io.File dir = new java.io.File(System.getProperty("user.home"), ".probloom");
            dir.mkdirs();
            return new java.io.File(dir, "license.lic").getAbsolutePath();
        }
        return "license.lic"; // dev mode: working directory
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // -----------------------------------------------
    // Machine Identity
    // -----------------------------------------------

    public String getMachineHardwareId() {
        return HardwareUtil.getHardwareId();
    }

    /**
     * Generates the content for the machine.req file.
     * This file is sent by the customer to ProBloom HQ so they can generate a license.
     */
    public Map<String, Object> generateLicenseRequest(Map<String, Object> customerDetails) {
        Map<String, Object> req = new HashMap<>();
        req.put("hardwareId", getMachineHardwareId());
        req.put("requestedAt", Instant.now().toString());
        req.put("appVersion", "1.0.0");
        req.put("type", "LICENSE_REQUEST");
        req.put("customer", customerDetails != null ? customerDetails : new HashMap<>());
        return req;
    }

    // -----------------------------------------------
    // License Validation
    // -----------------------------------------------

    /**
     * Returns a map describing the current license status. Never throws - always returns a status.
     */
    public Map<String, Object> getLicenseStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("hardwareId", getMachineHardwareId());

        File licFile = new File(getLicenseFilePath());
        if (!licFile.exists()) {
            status.put("valid", false);
            status.put("status", "MISSING");
            status.put("message", "No license file found. Please generate a license request and send it to ProBloom HQ.");
            return status;
        }

        try {
            String b64Content = new String(Files.readAllBytes(licFile.toPath()), StandardCharsets.UTF_8).trim();
            String rawJson = new String(Base64.getDecoder().decode(b64Content), StandardCharsets.UTF_8);

            @SuppressWarnings("unchecked")
            Map<String, Object> licenseData = objectMapper.readValue(rawJson, Map.class);

            String signature = (String) licenseData.get("signature");
            String licHardwareId = (String) licenseData.get("hardwareId");
            String issuedAtStr = (String) licenseData.get("issuedAt");
            String expiresAtStr = (String) licenseData.get("expiresAt");

            // Build payload map (same order as when signed)
            Map<String, Object> payload = new HashMap<>();
            payload.put("hardwareId", licHardwareId);
            payload.put("issuedAt", issuedAtStr);
            payload.put("expiresAt", expiresAtStr);
            payload.put("features", licenseData.get("features"));
            if (licenseData.containsKey("customer")) {
                payload.put("customer", licenseData.get("customer"));
            }
            if (licenseData.containsKey("generatedPassword")) {
                payload.put("generatedPassword", licenseData.get("generatedPassword"));
            }

            // 1. Verify signature
            if (!verifySignature(objectMapper.writeValueAsString(payload), signature)) {
                status.put("valid", false);
                status.put("status", "INVALID_SIGNATURE");
                status.put("message", "License signature is invalid. This license file may be tampered with.");
                return status;
            }

            // 2. Verify hardware ID
            String currentHardwareId = getMachineHardwareId();
            if (!currentHardwareId.equals(licHardwareId)) {
                status.put("valid", false);
                status.put("status", "HARDWARE_MISMATCH");
                status.put("message", "This license is not valid for this machine.");
                return status;
            }

            // 3. Check expiration
            Instant expiresAt = Instant.parse(expiresAtStr);
            Instant now = Instant.now();

            if (now.isAfter(expiresAt)) {
                status.put("valid", false);
                status.put("status", "EXPIRED");
                status.put("message", "Your license expired on " + expiresAtStr + ". Please contact ProBloom HQ to renew.");
                status.put("expiresAt", expiresAtStr);
                return status;
            }

            // All checks passed
            long daysLeft = (expiresAt.getEpochSecond() - now.getEpochSecond()) / 86400;
            status.put("valid", true);
            status.put("status", "ACTIVE");
            status.put("issuedAt", issuedAtStr);
            status.put("expiresAt", expiresAtStr);
            status.put("daysLeft", daysLeft);
            if (licenseData.containsKey("customer")) {
                status.put("customer", licenseData.get("customer"));
            }
            if (licenseData.containsKey("generatedPassword")) {
                status.put("generatedPassword", licenseData.get("generatedPassword"));
            }
            if (daysLeft <= 30) {
                status.put("warning", "Your license expires in " + daysLeft + " days. Please contact ProBloom HQ soon to renew.");
            }
            status.put("message", "License is active and valid.");
            return status;

        } catch (Exception e) {
            status.put("valid", false);
            status.put("status", "CORRUPT");
            status.put("message", "License file is corrupt or unreadable: " + e.getMessage());
            return status;
        }
    }

    /**
     * Returns true if the current license is valid, false otherwise.
     */
    public boolean isLicenseValid() {
        Map<String, Object> status = getLicenseStatus();
        return Boolean.TRUE.equals(status.get("valid"));
    }

    /**
     * Saves an uploaded .lic file to the application root directory.
     */
    public Map<String, Object> uploadLicense(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No license file provided.");
        }
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.endsWith(".lic")) {
            throw new IllegalArgumentException("Invalid file type. Only .lic files are accepted.");
        }

        Path destination = Paths.get(getLicenseFilePath());
        Files.write(destination, file.getBytes());

        // Auto-provision user account if valid
        Map<String, Object> status = getLicenseStatus();
        if (Boolean.TRUE.equals(status.get("valid"))) {
            syncUserFromLicense(status);
        }

        return status;
    }

    /**
     * Removes the current license file.
     */
    public boolean removeLicense() {
        File licFile = new File(getLicenseFilePath());
        if (licFile.exists()) {
            return licFile.delete();
        }
        return false;
    }

    /**
     * Ensures the owner user exists in the local database based on license data.
     */
    private void syncUserFromLicense(Map<String, Object> status) {
        try {
            String email = (String) status.get("email");
            if (email == null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> customer = (Map<String, Object>) status.get("customer");
                if (customer != null) email = (String) customer.get("email");
            }
            
            if (email == null) return;

            String generatedPassword = (String) status.get("generatedPassword");
            
            Optional<User> existingUser = userRepository.findByEmail(email);
            if (existingUser.isEmpty()) {
                // If creating a new user, we MUST have a password
                if (generatedPassword == null) {
                    System.err.println("Cannot create user from license: generatedPassword is null");
                    return;
                }

                @SuppressWarnings("unchecked")
                Map<String, Object> customer = (Map<String, Object>) status.get("customer");
                String name = customer != null && customer.get("name") != null ? customer.get("name").toString() : "System Admin";
                String restaurant = customer != null && customer.get("shopName") != null ? customer.get("shopName").toString() : "Local Kitchen";
                
                User user = User.builder()
                        .name(name)
                        .email(email)
                        .password(passwordEncoder.encode(generatedPassword))
                        .restaurantName(restaurant)
                        .role(User.Role.OWNER)
                        .isApproved(true)
                        .isActive(true)
                        .onboardingCompleted(true)
                        .licenseType("hardware")
                        .build();
                
                // Use Objects.requireNonNull to satisfy null analysis and prevent potential NPE
                userRepository.save(Objects.requireNonNull(user));
            } else {
                // Update password if it's provided in the status
                if (generatedPassword != null) {
                    User user = existingUser.get();
                    user.setPassword(passwordEncoder.encode(generatedPassword));
                    userRepository.save(user);
                }
            }
        } catch (Exception e) {
            // Log error but don't fail the upload
            System.err.println("Failed to sync user from license: " + e.getMessage());
        }
    }

    // -----------------------------------------------
    // Cryptographic Verification
    // -----------------------------------------------

    private boolean verifySignature(String payloadJson, String signatureBase64) {
        try {
            byte[] keyBytes = Base64.getDecoder().decode(PUBLIC_KEY_PEM);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PublicKey publicKey = kf.generatePublic(spec);

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(payloadJson.getBytes(StandardCharsets.UTF_8));

            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
            return sig.verify(signatureBytes);
        } catch (Exception e) {
            return false;
        }
    }
}
