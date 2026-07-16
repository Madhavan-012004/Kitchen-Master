package com.probloom.service;

import com.probloom.exception.BadRequestException;
import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import com.probloom.util.LicenseUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.time.Instant;
import java.nio.charset.StandardCharsets;

@Service
public class MasterService {

    private static final String PRIVATE_KEY_PEM =
        "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDg2dCPiMkTo55+" +
        "BzF5j6wXiwLYSe/5IFvEl0NchXWXZLiIuMkZTgjgC8J1wLjbkEQ7J5WfFJDOh+1r" +
        "zg8olXkB1XDVJXox6j802BIo5ezzqJActL55wx+J/JvoirSg5I7//OnsSYxfcBgy" +
        "ntscuxqRsuYfXP7V3MarbV1EzJQPUDXS2TRK1aLdk1/yNoLeuTMiW/O/vyj66GRT" +
        "CfNEgSZEzF2TWqzZwuNdEy8LRmI+JrxHLL6p4N017/sP+br3kCsDue1XQ7knnqHZ" +
        "TEMde0HpyEzO0qfN870AX3DaSDNvHTxZRB1xn7/z7WPlr/HvZ6aCmEj/uZbdtGy7" +
        "QMxSI3w/AgMBAAECggEAEcKSmyvCOidj1u+JhGEJRkjIHj5k0ogwR2xtOSsfeShO" +
        "/RmfZLzJraywHO3ujAUupn9/bXPJ5k5NPgUmJF3+E1uBEIznxHaMrIdek9VpbGuF" +
        "iobqPqLfZF5MEEeYcdbrxqN69Jtwl386ohDzHKdYt2Zqj9KgHFNWa+b1BYClNzpI" +
        "OXIE1nsHg2jITk5apJM2cRfzgIr0N58X0HdyMuM73h9cHyBakUykKB4QsBcJahVE" +
        "QGvtExnfIcpKn2XswbCkgbhd9Up3304D9lRTI51+GVSx4tTdCPYxdfmfdB2JfORy" +
        "S6iGxDEFkKqJJcyx+KHvfY64j6T3DO9aW5HgDR7lgQKBgQD9HPdF66/n8sOgivQ5" +
        "JtpPCHsq3hOupRsoELrYuBwwXciVinYseDJO30bTpibRJYcSuSALbZn4k08U8RrV" +
        "LVFPG6/q2BT1JYIRsFkTDLb9AYtEbYujzO65ymXf7zZ6lAAIc2c0VWCBAMpKFfWL" +
        "4hgdntF40Q37zBN2dTaSqZdygQKBgQDjalRBYXQdjoo6o5XRmOtgnJ2e/nqnVbZR" +
        "BuB3Yd32Z2+ts3Yo0JRKkbelMqTlL+6yyyQ9lRl1NPFXMDoPFCKcY6GtWn3CwiXl" +
        "kzzZ9/V3L6kas5Tpp0xaqZHwLhrds+zAw2Cca7Sv5N1Ufz/Dbh88jrRvYdqtMuQ6" +
        "5SwYbOIOvwKBgQDAjAtzblK3sU6uT2ZwH6VNIBeKSbxRTBp3hRqOiKgxBvbzA4zY" +
        "UWt74pBfq3K2AcVaMeg1qV/K4Ez1kmCmML483sQZc92li64BxNROEIsXttf56xei" +
        "OOCWB2kuTCx2XSYVR60H+7bZC//XEhNkIU/VIJ8bOHVZyio4H/yu30JtgQKBgAqU" +
        "gtD74LQTUpkBzVGQBLtc7fRcsIYidbX1VPIY6oOxMj/pjoC9m3iQqPOVlJhZD4jf" +
        "7JK04hdS3DuLMdhLvoR6GiZ/hERQVgUFQZp+b7wYyoxEeJQaRXIeW3zKGFPiMAyT" +
        "ymXcmO5p/mYU+Xl1IRznIrvf2JWgPYAD83Y7cpTvAoGAR1F4dSd6u7L5lCEiAT2g" +
        "Efp6FUlGAVI6SFwS5m2AT82TC40JnM41SHU9e0rqE+LG3cJ4lOnrwWk/CFl9LyOJ" +
        "H5ybkd5XJPH0eleD79uatVV+R5IlXQuuLZ5Me0U9tHZqXTOQEMv34LEa+qP0NHUq" +
        "qqrD5AdNDj9an/HwKiWHeDM=";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.probloom.repository.StakeholderMappingRepository stakeholderMappingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthService authService;

    private User getAdmin(@NonNull Long adminId) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found"));
        if (!Boolean.TRUE.equals(admin.getIsProBloomAdmin())) {
            throw new BadRequestException("Access denied. ProBloom Super Admin only.");
        }
        return admin;
    }

    public Map<String, Object> getClientsAndStats(@NonNull Long adminId, String search, String status, String licenseType) {
        getAdmin(adminId);

        List<User> allClients = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.OWNER && !Boolean.TRUE.equals(u.getIsProBloomAdmin()))
                .collect(Collectors.toList());

        // Stats calculation
        long total = allClients.size();
        long active = 0, expired = 0, expiringSoon = 0, digital = 0, prime = 0, pending = 0;

        LocalDateTime now = LocalDateTime.now();
        for (User u : allClients) {
            if (!Boolean.TRUE.equals(u.getIsApproved())) {
                pending++;
            } else {
                if (u.getSubscriptionExpiresAt() != null) {
                    if (now.isAfter(u.getSubscriptionExpiresAt())) {
                        expired++;
                    } else if (now.plusDays(30).isAfter(u.getSubscriptionExpiresAt())) {
                        expiringSoon++;
                    } else {
                        active++;
                    }
                } else {
                    active++;
                }
            }

            if ("prime".equalsIgnoreCase(u.getLicenseType())) prime++;
            else digital++;
        }

        // Apply filters
        List<Map<String, Object>> filtered = allClients.stream()
                .filter(u -> {
                    if (search != null && !search.isEmpty()) {
                        String s = search.toLowerCase();
                        boolean match = (u.getRestaurantName() != null && u.getRestaurantName().toLowerCase().contains(s)) ||
                                        (u.getEmail() != null && u.getEmail().toLowerCase().contains(s)) ||
                                        (u.getName() != null && u.getName().toLowerCase().contains(s));
                        if (!match) return false;
                    }
                    if (status != null && !status.equals("all")) {
                        if ("pending".equalsIgnoreCase(status)) {
                            if (Boolean.TRUE.equals(u.getIsApproved())) return false;
                        } else {
                            // If filtering by anything other than "pending", we only want approved users
                            if (!Boolean.TRUE.equals(u.getIsApproved())) return false;
                            
                            if (!u.getIsActive() && !status.equals("inactive")) return false;
                            if (u.getSubscriptionExpiresAt() != null) {
                                if (status.equals("expired") && !now.isAfter(u.getSubscriptionExpiresAt())) return false;
                                if (status.equals("expiring_soon") && (!now.isBefore(u.getSubscriptionExpiresAt()) || !now.plusDays(30).isAfter(u.getSubscriptionExpiresAt()))) return false;
                                if (status.equals("active") && (now.isAfter(u.getSubscriptionExpiresAt()) || now.plusDays(30).isAfter(u.getSubscriptionExpiresAt()))) return false;
                            }
                        }
                    } else {
                        // By default (or "all"), we hide pending users unless explicitly asked for "pending" or "all"
                        // Or actually, let's show everything in "all".
                    }
                    if (licenseType != null && !licenseType.equals("all")) {
                        String lt = u.getLicenseType() != null ? u.getLicenseType() : "digital";
                        if (!lt.equalsIgnoreCase(licenseType)) return false;
                    }
                    return true;
                })
                .filter(u -> !Boolean.TRUE.equals(u.getIsProBloomAdmin())) // Exclude Super Admins
                .sorted((u1, u2) -> {
                    LocalDateTime d1 = u1.getCreatedAt() != null ? u1.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime d2 = u2.getCreatedAt() != null ? u2.getCreatedAt() : LocalDateTime.MIN;
                    return d2.compareTo(d1); // DESC
                })
                .map(u -> serializeClient(Objects.requireNonNull(u), Objects.requireNonNull(now)))
                .collect(Collectors.toList());

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("active", active);
        stats.put("expired", expired);
        stats.put("expiringSoon", expiringSoon);
        stats.put("digital", digital);
        stats.put("prime", prime);
        stats.put("pending", pending);

        Map<String, Object> response = new HashMap<>();
        response.put("clients", filtered);
        response.put("stats", stats);
        return response;
    }

    private Map<String, Object> serializeClient(@NonNull User u, @NonNull LocalDateTime now) {
        Map<String, Object> map = authService.sanitizeUser(u);
        String subStatus = "active";
        if (u.getSubscriptionExpiresAt() != null) {
            if (now.isAfter(u.getSubscriptionExpiresAt())) subStatus = "expired";
            else if (now.plusDays(30).isAfter(u.getSubscriptionExpiresAt())) subStatus = "expiring_soon";
        }
        map.put("licenseStatus", subStatus);
        map.put("licenseType", u.getLicenseType() != null ? u.getLicenseType() : "digital");
        map.put("isActive", u.getIsActive());
        Map<String, Object> subMap = new HashMap<>();
        subMap.put("expiresAt", u.getSubscriptionExpiresAt());
        map.put("subscription", subMap);
        return map;
    }

    public Map<String, Object> createClient(@NonNull Long adminId, @NonNull Map<String, Object> req, String type) {
        getAdmin(adminId);
        
        String email = (String) req.get("email");
        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email already exists");
        }

        User user = User.builder()
                .name((String) req.get("name"))
                .email(email)
                .password(passwordEncoder.encode((String) req.get("password")))
                .restaurantName((String) req.get("restaurantName"))
                .phone((String) req.get("phone"))
                .role(User.Role.OWNER)
                .isActive(true)
                .isApproved(true)
                .onboardingCompleted(true)
                .build();
                
        user.setLicenseType(type);
        user.setSubscriptionPlan(User.SubscriptionPlan.ENTERPRISE);
        user.setSubscriptionStartedAt(LocalDateTime.now());
        user.setSubscriptionExpiresAt(LocalDateTime.now().plusYears(1));

        user = Objects.requireNonNull(userRepository.save(user));

        String licenseKey = null;
        if ("prime".equalsIgnoreCase(type)) {
            licenseKey = LicenseUtils.generateLicenseKey(user.getId(), user.getEmail(), user.getSubscriptionExpiresAt().toString());
            user.setLicenseKey(licenseKey);
            user = Objects.requireNonNull(userRepository.save(user));
        }

        Map<String, Object> data = new HashMap<>();
        data.put("user", serializeClient(Objects.requireNonNull(user), Objects.requireNonNull(LocalDateTime.now())));
        data.put("licenseKey", licenseKey);
        return data;
    }

    public Map<String, Object> renewClient(@NonNull Long adminId, @NonNull Long clientId) {
        getAdmin(adminId);
        User user = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found"));
        
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime currentExpiry = user.getSubscriptionExpiresAt() != null ? user.getSubscriptionExpiresAt() : now;
        
        LocalDateTime newExpiry;
        if (currentExpiry.isAfter(now)) {
            newExpiry = currentExpiry.plusYears(1);
        } else {
            newExpiry = now.plusYears(1);
        }
        
        user.setSubscriptionExpiresAt(newExpiry);
        user.setSubscriptionActive(true);

        String licenseKey = null;
        if ("prime".equalsIgnoreCase(user.getLicenseType())) {
            licenseKey = LicenseUtils.generateLicenseKey(user.getId(), user.getEmail(), newExpiry.toString());
            user.setLicenseKey(licenseKey);
        }

        Objects.requireNonNull(userRepository.save(user));

        Map<String, Object> res = new HashMap<>();
        res.put("newExpiry", newExpiry);
        res.put("licenseKey", licenseKey);
        return res;
    }

    public Map<String, Object> generateLicense(@NonNull Long adminId, @NonNull Long clientId) {
        getAdmin(adminId);
        User user = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found"));
        
        if (!"prime".equalsIgnoreCase(user.getLicenseType())) {
            throw new BadRequestException("Can only generate license keys for PRIME clients.");
        }

        if (user.getSubscriptionExpiresAt() == null) {
            user.setSubscriptionExpiresAt(LocalDateTime.now().plusYears(1));
        }

        String licenseKey = LicenseUtils.generateLicenseKey(user.getId(), user.getEmail(), user.getSubscriptionExpiresAt().toString());
        user.setLicenseKey(licenseKey);
        Objects.requireNonNull(userRepository.save(user));

        Map<String, Object> res = new HashMap<>();
        res.put("licenseKey", licenseKey);
        return res;
    }

    public Map<String, Object> generateAndEmailLicense(@NonNull Long adminId, @NonNull org.springframework.web.multipart.MultipartFile file, String expiryDate) {
        getAdmin(adminId);
        
        try {
            String content = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            @SuppressWarnings("unchecked")
            Map<String, Object> reqData = mapper.readValue(content, Map.class);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> customer = (Map<String, Object>) reqData.getOrDefault("customer", new HashMap<>());
            String hwId = (String) reqData.getOrDefault("hardwareId", java.util.UUID.randomUUID().toString());
            
            String email = (String) customer.get("email");
            if (email == null || email.trim().isEmpty()) {
                email = "offline_" + hwId.toLowerCase() + "@local.probloom";
            }
            
            User user = userRepository.findByEmail(email).orElse(null);
            String generatedPassword = null;
            
            if (user == null) {
                generatedPassword = java.util.UUID.randomUUID().toString().substring(0, 8);
                user = User.builder()
                        .name((String) customer.getOrDefault("name", "Offline Client"))
                        .email(email)
                        .password(passwordEncoder.encode(generatedPassword))
                        .restaurantName((String) customer.getOrDefault("shopName", "Offline Restaurant"))
                        .phone((String) customer.getOrDefault("phone", ""))
                        .address((String) customer.getOrDefault("address", ""))
                        .role(User.Role.OWNER)
                        .isActive(true)
                        .isApproved(true)
                        .onboardingCompleted(true)
                        .build();
                        
                user.setLicenseType("prime");
                user.setSubscriptionPlan(User.SubscriptionPlan.ENTERPRISE);
                user.setSubscriptionStartedAt(LocalDateTime.now());
                user.setSubscriptionExpiresAt(LocalDateTime.parse(expiryDate + "T23:59:59"));
                user = Objects.requireNonNull(userRepository.save(user));
            } else {
                user.setSubscriptionExpiresAt(LocalDateTime.parse(expiryDate + "T23:59:59"));
            }
            
            // Generate RSA signed JSON license for standalone desktop app
            Map<String, Object> payload = new HashMap<>();
            payload.put("hardwareId", hwId);
            payload.put("issuedAt", Instant.now().toString());
            
            // Format expiry as Instant
            String expiresAtStr;
            try {
                expiresAtStr = Instant.parse(expiryDate + "T23:59:59Z").toString();
            } catch (Exception e) {
                // If it fails to parse, maybe it's already an ISO string
                expiresAtStr = Instant.parse(expiryDate).toString();
            }
            payload.put("expiresAt", expiresAtStr);
            payload.put("features", null);
            payload.put("customer", customer);
            if (generatedPassword != null) {
                payload.put("generatedPassword", generatedPassword);
            }

            // Generate Signature
            String payloadJson = mapper.writeValueAsString(payload);
            
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(PRIVATE_KEY_PEM));
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PrivateKey privateKey = kf.generatePrivate(spec);
            
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privateKey);
            sig.update(payloadJson.getBytes(StandardCharsets.UTF_8));
            String rsaSignature = Base64.getEncoder().encodeToString(sig.sign());
            
            // Assemble full license data
            Map<String, Object> fullLicense = new HashMap<>(payload);
            fullLicense.put("signature", rsaSignature);
            
            String rawJson = mapper.writeValueAsString(fullLicense);
            String licenseB64 = Base64.getEncoder().encodeToString(rawJson.getBytes(StandardCharsets.UTF_8));
            
            user.setLicenseKey(licenseB64);
            Objects.requireNonNull(userRepository.save(user));
            
            // Dispatch Email via Backend to bypass EmailJS "non-browser" restriction
            sendEmailViaEmailJS(email, user.getRestaurantName(), generatedPassword, licenseB64, expiryDate);
            
            Map<String, Object> res = new HashMap<>();
            res.put("licenseB64", licenseB64);
            res.put("email", email);
            res.put("generatedPassword", generatedPassword != null ? generatedPassword : "(Existing Account)");
            res.put("customerName", user.getRestaurantName());
            return res;
            
        } catch (Exception e) {
            throw new BadRequestException("Failed to process machine.req: " + e.getMessage());
        }
    }

    public Map<String, Object> toggleStatus(@NonNull Long adminId, @NonNull Long clientId) {
        getAdmin(adminId);
        User user = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found"));
        
        // If unapproved, toggleStatus will approve them first
        if (!Boolean.TRUE.equals(user.getIsApproved())) {
            user.setIsApproved(true);
            user.setIsActive(true);
            user.setTempPassword(null); // Wipe sensitive data after activation
        } else {
            user.setIsActive(!user.getIsActive());
        }
        
        Objects.requireNonNull(userRepository.save(user));
        
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("isApproved", user.getIsApproved());
        res.put("isActive", user.getIsActive());
        return res;
    }

    public void deleteClient(@NonNull Long adminId, @NonNull Long clientId) {
        getAdmin(adminId);
        User user = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found"));
        
        // Clean up stakeholder mappings first to avoid foreign key constraints
        stakeholderMappingRepository.deleteByUserId(clientId);
        
        userRepository.delete(Objects.requireNonNull(user));
    }

    private void sendEmailViaEmailJS(String email, String customerName, String generatedPassword, String licenseB64, String expiryDate) {
        try {
            Map<String, Object> templateParams = new HashMap<>();
            templateParams.put("to_email", email);
            templateParams.put("customer_name", customerName);
            templateParams.put("generated_password", generatedPassword != null ? generatedPassword : "(Existing Account)");
            templateParams.put("license_file", licenseB64);
            templateParams.put("expiry_date", expiryDate);

            Map<String, Object> payload = new HashMap<>();
            payload.put("service_id", "service_oblwsjg");
            payload.put("template_id", "template_aalh1yb");
            payload.put("user_id", "Vjm57tVlA_OAiZ1H8");
            payload.put("template_params", templateParams);

            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            headers.set("Origin", "http://localhost"); // Bypass EmailJS non-browser restriction

            org.springframework.http.HttpEntity<Map<String, Object>> request = new org.springframework.http.HttpEntity<>(payload, headers);
            
            restTemplate.postForEntity("https://api.emailjs.com/api/v1.0/email/send", request, String.class);
            System.out.println("EmailJS dispatch successful via backend.");
        } catch (Exception e) {
            System.err.println("EmailJS dispatch failed: " + e.getMessage());
        }
    }
}
