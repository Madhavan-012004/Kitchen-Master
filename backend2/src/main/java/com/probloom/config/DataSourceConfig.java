package com.probloom.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

/**
 * Configures the dual routing datasource for standalone mode.
 *
 * Two datasources are wired:
 *  - "offline" → embedded PostgreSQL (port 5433, always available)
 *  - "online"  → cloud PostgreSQL   (from application.yml env vars)
 *
 * The DualRoutingDataSource delegates to the correct one based on
 * DataSourceModeHolder.getMode().
 */
@Configuration
@Profile("standalone")
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url:#{null}}")
    private String cloudUrl;

    @Value("${spring.datasource.username:postgres}")
    private String cloudUsername;

    @Value("${spring.datasource.password:root}")
    private String cloudPassword;

    @Autowired
    private EmbeddedPostgres embeddedPostgres;

    @Bean
    @Primary
    public DataSource dataSource() {
        // ── Offline (embedded) datasource ────────────────────────────────
        DataSource offlineDs = buildOfflineDataSource();

        // ── Online (cloud) datasource ─────────────────────────────────────
        DataSource onlineDs = buildOnlineDataSource();

        // ── Routing datasource ────────────────────────────────────────────
        DualRoutingDataSource routing = new DualRoutingDataSource();

        Map<Object, Object> targets = new HashMap<>();
        targets.put(DataSourceModeHolder.MODE_OFFLINE, offlineDs);
        targets.put(DataSourceModeHolder.MODE_ONLINE, onlineDs);
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(offlineDs);
        routing.afterPropertiesSet();

        log.info("[DataSource] Dual routing datasource configured. Default mode: offline");
        return routing;
    }

    private DataSource buildOfflineDataSource() {
        // Ensure the local database exists before connecting
        ensureLocalDatabase();

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(EmbeddedPostgresConfig.getOfflineJdbcUrl());
        config.setUsername("postgres");
        config.setPassword("postgres");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setPoolName("OfflinePool");
        log.info("[DataSource] Offline pool → {}", config.getJdbcUrl());
        return new HikariDataSource(config);
    }

    private DataSource buildOnlineDataSource() {
        // Build the online datasource from env/config. If the cloud URL is the
        // embedded one (localhost:5433) we skip and fall back to the offline pool.
        String url = resolveCloudUrl();

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(cloudUsername);
        config.setPassword(cloudPassword);
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(15000);
        config.setInitializationFailTimeout(-1); // Don't fail at startup if cloud is down
        config.setPoolName("OnlinePool");
        log.info("[DataSource] Online pool → {}", url);
        return new HikariDataSource(config);
    }

    /**
     * Creates the local database inside the embedded PostgreSQL if it doesn't exist.
     */
    private void ensureLocalDatabase() {
        String dbName = "km_local";
        // Connect to the default "postgres" database to run CREATE DATABASE
        String adminUrl = "jdbc:postgresql://localhost:5433/postgres";
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(adminUrl, "postgres", "postgres");
             Statement stmt = conn.createStatement()) {
            // Check if database exists
            var rs = stmt.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + dbName + "'");
            if (!rs.next()) {
                stmt.executeUpdate("CREATE DATABASE " + dbName);
                log.info("[DataSource] Created local database: {}", dbName);
            } else {
                log.info("[DataSource] Local database '{}' already exists.", dbName);
            }
        } catch (Exception e) {
            log.warn("[DataSource] Could not ensure local database (will retry on first connection): {}", e.getMessage());
        }
    }

    private String resolveCloudUrl() {
        // If cloud URL is not set or points to embedded, use a placeholder that
        // will return connection errors gracefully until the user configures it.
        if (cloudUrl == null || cloudUrl.contains("5433") || cloudUrl.contains("km_local")) {
            // Use the external PG from the environment (original config)
            String host = System.getenv("DB_HOST");
            String port = System.getenv("DB_PORT");
            String name = System.getenv("DB_NAME");
            if (host != null && name != null) {
                return String.format("jdbc:postgresql://%s:%s/%s",
                        host,
                        port != null ? port : "5432",
                        name);
            }
            // Final fallback — standard cloud default
            return "jdbc:postgresql://localhost:5432/kitchen_master_db";
        }
        return cloudUrl;
    }
}
