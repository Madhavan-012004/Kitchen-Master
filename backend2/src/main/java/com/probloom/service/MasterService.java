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

@Service
public class MasterService {

    @Autowired
    private UserRepository userRepository;

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
        userRepository.delete(Objects.requireNonNull(user));
    }
}
