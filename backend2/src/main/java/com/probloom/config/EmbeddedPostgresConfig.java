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
    private static final int EMBEDDED_PG_PORT = 5433;
    private static final String DB_NAME = "km_local";

    private EmbeddedPostgres embeddedPostgres;

    @Bean
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        File dataDir = resolveDataDirectory();
        log.info("[Standalone] Starting embedded PostgreSQL on port {} with data dir: {}", EMBEDDED_PG_PORT, dataDir);

        embeddedPostgres = EmbeddedPostgres.builder()
                .setPort(EMBEDDED_PG_PORT)
                .setDataDirectory(dataDir)
                .start();

        log.info("[Standalone] Embedded PostgreSQL started successfully. JDBC URL: {}", getJdbcUrl());
        return embeddedPostgres;
    }

    @Bean
    public String embeddedPgJdbcUrl(EmbeddedPostgres pg) {
        return "jdbc:postgresql://localhost:" + EMBEDDED_PG_PORT + "/" + DB_NAME;
    }

    public static String getOfflineJdbcUrl() {
        return "jdbc:postgresql://localhost:" + EMBEDDED_PG_PORT + "/" + DB_NAME;
    }

    private String getJdbcUrl() {
        return "jdbc:postgresql://localhost:" + EMBEDDED_PG_PORT + "/" + DB_NAME;
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
