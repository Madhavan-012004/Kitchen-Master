package com.probloom.util;

import java.net.NetworkInterface;
import java.security.MessageDigest;
import java.util.Enumeration;

public class HardwareUtil {

    public static String getHardwareId() {
        try {
            Enumeration<NetworkInterface> networkInterfaces = NetworkInterface.getNetworkInterfaces();
            StringBuilder macAddressStr = new StringBuilder();

            while (networkInterfaces.hasMoreElements()) {
                NetworkInterface network = networkInterfaces.nextElement();
                byte[] mac = network.getHardwareAddress();

                if (mac != null) {
                    for (int i = 0; i < mac.length; i++) {
                        macAddressStr.append(String.format("%02X%s", mac[i], (i < mac.length - 1) ? "-" : ""));
                    }
                    // Break after finding the first valid MAC address
                    if (macAddressStr.length() > 0) {
                        break;
                    }
                }
            }

            if (macAddressStr.length() == 0) {
                // Fallback: use user name and OS name instead of slow network lookup
                macAddressStr.append(System.getProperty("user.name", "user"))
                            .append("-")
                            .append(System.getProperty("os.name", "os"));
            }

            // Hash the hardware identifier to create a consistent, non-raw string
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(macAddressStr.toString().getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();

            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }

            String result = hexString.toString();
            if (result.length() < 16) {
                return "GENERIC-HWID-001";
            }
            return result.substring(0, 16).toUpperCase();

        } catch (Exception e) {
            System.err.println("Error generating hardware ID: " + e.getMessage());
            e.printStackTrace();
            return "UNKNOWN-HARDWARE-ID";
        }
    }
}
