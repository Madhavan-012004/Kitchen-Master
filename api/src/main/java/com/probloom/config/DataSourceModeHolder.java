package com.probloom.config;

/**
 * Global (JVM-wide) holder for the active database mode.
 * "offline" → embedded PostgreSQL (on-device)
 * "online"  → cloud PostgreSQL (external server)
 *
 * This is intentionally a simple static volatile field because the entire
 * application switches mode at once (not per-thread).
 */
public class DataSourceModeHolder {

    public static final String MODE_OFFLINE = "offline";
    public static final String MODE_ONLINE  = "online";

    // Default: offline — the embedded PG is always available
    private static volatile String currentMode = MODE_OFFLINE;

    public static void setMode(String mode) {
        if (!MODE_OFFLINE.equals(mode) && !MODE_ONLINE.equals(mode)) {
            throw new IllegalArgumentException("Invalid mode: " + mode + ". Must be 'online' or 'offline'.");
        }
        currentMode = mode;
    }

    public static String getMode() {
        return currentMode;
    }

    public static boolean isOffline() {
        return MODE_OFFLINE.equals(currentMode);
    }
}
