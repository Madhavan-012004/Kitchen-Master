package com.probloom.service;

import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.Optional;

/**
 * Handles the Offline-First login strategy:
 *
 * 1. Try to find user in the LOCAL database (offline, always available).
 * 2. If found locally → verify password and log in normally (fully offline).
 * 3. If NOT found locally → try the CLOUD database (requires internet).
 * 4. If found in cloud → verify password, then SYNC the user into local DB
 * so the next login works offline.
 * 5. If neither found → throw "Invalid credentials".
 *
 * This service is profile-agnostic — it can activate for all profiles
 * but is primarily used in the Electron (standalone offline) mode.
 */
@Service
public class OfflineFirstLoginService {

    private static final Logger log = LoggerFactory.getLogger(OfflineFirstLoginService.class);

    @Autowired
    private UserRepository localUserRepository;

    // Cloud DB connection details — injected from environment variables or
    // application.yml
    // These are expected to be set as JVM -D args or env vars on the machine
    @Value("${offline.cloud.url:#{null}}")
    private String cloudUrl;

    @Value("${offline.cloud.username:#{null}}")
    private String cloudUsername;

    @Value("${offline.cloud.password:#{null}}")
    private String cloudPassword;

    /**
     * Returns true if the cloud DB is configured (URL is set and non-empty)
     */
    public boolean isCloudConfigured() {
        return cloudUrl != null && !cloudUrl.isBlank()
                && cloudUsername != null && !cloudUsername.isBlank();
    }

    /**
     * Performs offline-first authentication.
     *
     * @param identifier email or phone
     * @return the authenticated User from local DB (synced from cloud if needed)
     * @throws RuntimeException if not found in either location or password mismatch
     */
    public Optional<User> findUserOfflineFirst(String identifier) {
        // ── Step 1: Try local database ──────────────────────────────────────
        Optional<User> localUser = findLocalUser(identifier);
        if (localUser.isPresent()) {
            log.info("[OfflineFirst] User '{}' found in local database ✓", identifier);
            return localUser;
        }

        log.info("[OfflineFirst] User '{}' not found locally — trying cloud fallback...", identifier);

        // ── Step 2: Try cloud database ──────────────────────────────────────
        if (!isCloudConfigured()) {
            log.warn("[OfflineFirst] Cloud DB not configured — no fallback available.");
            return Optional.empty();
        }

        try {
            CloudUserRecord cloudRecord = fetchUserFromCloud(identifier);
            if (cloudRecord == null) {
                log.warn("[OfflineFirst] User '{}' not found in cloud DB either.", identifier);
                return Optional.empty();
            }

            log.info("[OfflineFirst] User '{}' found in cloud DB — syncing to local...", identifier);

            // ── Step 3: Sync cloud user into local DB ──────────────────────
            User syncedUser = syncCloudUserToLocal(cloudRecord);
            log.info("[OfflineFirst] User '{}' synced to local DB — future logins will work offline ✓", identifier);
            return Optional.of(syncedUser);

        } catch (Exception e) {
            log.error("[OfflineFirst] Cloud fallback failed for '{}': {}", identifier, e.getMessage());
            return Optional.empty();
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private Optional<User> findLocalUser(String identifier) {
        try {
            Optional<User> byEmail = localUserRepository.findByEmail(identifier);
            if (byEmail.isPresent())
                return byEmail;

            Optional<User> byPhone = localUserRepository.findFirstByPhone(identifier);
            return byPhone;
        } catch (Exception e) {
            log.warn("[OfflineFirst] Local DB lookup failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Opens a direct JDBC connection to cloud DB and fetches specific fields.
     * We do NOT use JPA here to avoid affecting the local datasource context.
     */
    private CloudUserRecord fetchUserFromCloud(String identifier) throws SQLException {
        String sql = "SELECT id, name, email, phone, password, role, is_active, is_approved, " +
                "       restaurant_name, address, gst_number, license_type, " +
                "       subscription_expires_at, is_probloom_admin " +
                "FROM users " +
                "WHERE LOWER(email) = LOWER(?) OR phone = ? " +
                "LIMIT 1";

        try (Connection conn = DriverManager.getConnection(cloudUrl, cloudUsername, cloudPassword);
                PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setString(1, identifier);
            ps.setString(2, identifier);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next())
                    return null;

                CloudUserRecord r = new CloudUserRecord();
                r.id = rs.getLong("id");
                r.name = rs.getString("name");
                r.email = rs.getString("email");
                r.phone = rs.getString("phone");
                r.password = rs.getString("password");
                r.role = rs.getString("role");
                r.isActive = rs.getBoolean("is_active");
                r.isApproved = rs.getBoolean("is_approved");
                r.restaurantName = rs.getString("restaurant_name");
                r.address = rs.getString("address");
                r.gstNumber = rs.getString("gst_number");
                r.licenseType = rs.getString("license_type");
                r.isProBloomAdmin = rs.getBoolean("is_probloom_admin");
                return r;
            }
        }
    }

    /**
     * Saves a cloud user into the local database so future offline logins work.
     * If a user with the same email already exists locally (edge case), updates it.
     */
    private User syncCloudUserToLocal(CloudUserRecord rec) {
        // Check again in case of race condition
        Optional<User> existing = localUserRepository.findByEmail(rec.email);
        User user = existing.orElseGet(User::new);

        user.setName(rec.name);
        user.setEmail(rec.email);
        user.setPhone(rec.phone);
        user.setPassword(rec.password); // already bcrypt-hashed from cloud
        user.setRestaurantName(rec.restaurantName);
        user.setAddress(rec.address);
        user.setGstNumber(rec.gstNumber);
        user.setIsActive(rec.isActive);
        user.setIsApproved(rec.isApproved);
        user.setIsProBloomAdmin(rec.isProBloomAdmin);
        user.setLicenseType(rec.licenseType);

        try {
            user.setRole(User.Role.valueOf(rec.role));
        } catch (Exception e) {
            user.setRole(User.Role.OWNER);
        }

        return localUserRepository.save(user);
    }

    // ── Internal DTO ─────────────────────────────────────────────────────────
    static class CloudUserRecord {
        long id;
        String name, email, phone, password, role;
        boolean isActive, isApproved, isProBloomAdmin;
        String restaurantName, address, gstNumber, licenseType;
    }
}
