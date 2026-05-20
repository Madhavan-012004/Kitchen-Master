package com.probloom.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.File;
import java.io.IOException;

/**
 * Starts an embedded PostgreSQL instance when the "standalone" profile is active.
 * Data directory: %APPDATA%\ProBloom\pgdata  (Windows)
 *                 ~/.config/ProBloom/pgdata  (Linux/Mac fallback)
 *
 * Port 5433 is used to avoid conflict with any externally installed PostgreSQL (port 5432).
 */
@Configuration
@Profile("standalone")
public class EmbeddedPostgresConfig implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedPostgresConfig.class);
    private static final int EMBEDDED_PG_PORT = 5434;
    private static final String DB_NAME = "km_local";

    private EmbeddedPostgres embeddedPostgres;

    @Bean
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        File dataDir = resolveDataDirectory();
        log.info("[Standalone] Attempting to start embedded PostgreSQL on port {}...", EMBEDDED_PG_PORT);
        log.info("[Standalone] Data Directory: {}", dataDir.getAbsolutePath());

        try {
            embeddedPostgres = EmbeddedPostgres.builder()
                    .setPort(EMBEDDED_PG_PORT)
                    .setDataDirectory(dataDir)
                    .setCleanDataDirectory(false)
                    .start();
            log.info("[Standalone] Embedded PostgreSQL started successfully on port {}.", EMBEDDED_PG_PORT);
        } catch (IOException e) {
            log.error("[Standalone] CRITICAL: Failed to start Embedded PostgreSQL: {}", e.getMessage());
            log.error("[Standalone] This often happens on Windows if the data directory is corrupt or permissions are restricted.");
            throw e;
        }

        return embeddedPostgres;
    }

    @Bean
    public String embeddedPgJdbcUrl(EmbeddedPostgres pg) {
        return "jdbc:postgresql://localhost:5434/" + DB_NAME;
    }

    public static String getOfflineJdbcUrl() {
        return "jdbc:postgresql://localhost:5434/" + DB_NAME;
    }



    private File resolveDataDirectory() {
        // Windows: %APPDATA%\ProBloom\pgdata
        String appData = System.getenv("APPDATA");
        File base;
        if (appData != null && !appData.isEmpty()) {
            base = new File(appData, "ProBloom");
        } else {
            // Fallback: user home
            base = new File(System.getProperty("user.home"), ".probloom");
        }

        File pgData = new File(base, "pgdata");
        if (!pgData.exists()) {
            pgData.mkdirs();
            log.info("[Standalone] Created data directory: {}", pgData.getAbsolutePath());
        }
        return pgData;
    }

    @Override
    public void destroy() {
        if (embeddedPostgres != null) {
            try {
                embeddedPostgres.close();
                log.info("[Standalone] Embedded PostgreSQL stopped.");
            } catch (IOException e) {
                log.warn("[Standalone] Error stopping embedded PostgreSQL: {}", e.getMessage());
            }
        }
    }
}
