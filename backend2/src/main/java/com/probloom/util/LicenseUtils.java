package com.probloom.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

public class LicenseUtils {

    private static final String SECRET_KEY = System.getenv("PROBLOOM_LICENSE_SECRET") != null 
            ? System.getenv("PROBLOOM_LICENSE_SECRET") 
            : "pro_bloom_license_secret_2025_xtz_99#*&@!";

    /**
     * Generates a tamper-proof license key.
     * Format: Base64(restaurantId:ownerEmail:expiresAt:hmacSignature)
     */
    public static String generateLicenseKey(Long restaurantId, String ownerEmail, String expiresAtStr) {
        try {
            String payload = restaurantId + ":" + ownerEmail + ":" + expiresAtStr;
            String signature = generateHmac(payload, SECRET_KEY);
            String fullString = payload + ":" + signature;
            return Base64.getEncoder().encodeToString(fullString.getBytes("UTF-8"));
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate license key", e);
        }
    }

    /**
     * Verifies a license key. Returns true if valid and signature matches.
     */
    public static boolean verifyLicenseKey(String licenseKey) {
        try {
            String decoded = new String(Base64.getDecoder().decode(licenseKey), "UTF-8");
            String[] parts = decoded.split(":");
            if (parts.length != 4) return false;

            String payload = parts[0] + ":" + parts[1] + ":" + parts[2];
            String signature = parts[3];

            String expectedSignature = generateHmac(payload, SECRET_KEY);
            return signature.equals(expectedSignature);
        } catch (Exception e) {
            return false;
        }
    }

    private static String generateHmac(String data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(key.getBytes("UTF-8"), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] hmacBytes = mac.doFinal(data.getBytes("UTF-8"));
        return Base64.getEncoder().encodeToString(hmacBytes);
    }
}
