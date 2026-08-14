package com.probloom.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j

public class DatabaseBackupService {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Value("${spring.datasource.username}")
    private String dbUser;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @org.springframework.beans.factory.annotation.Autowired
    private com.probloom.repository.UserRepository userRepository;

    private static final String BACKUP_DIR = "database_dump";
    private static final DateTimeFormatter FILE_NAME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    @Scheduled(cron = "0 0 1 * * ?") // Daily at 1 AM
    public void scheduledBackup() {
        log.info("Starting scheduled database backup...");
        try {
            exportDatabase("auto_scheduled");
        } catch (Exception e) {
            log.error("Scheduled backup failed", e);
        }
    }

    public String exportDatabase(String prefix) throws IOException, InterruptedException {
        // 1. Ensure backup directory exists
        File dir = new File(BACKUP_DIR);
        if (!dir.exists())
            dir.mkdirs();

        // 2. Parse DB details from URL
        // jdbc:postgresql://localhost:5432/db_name
        String dbName = dbUrl.substring(dbUrl.lastIndexOf("/") + 1);
        String hostPort = dbUrl.substring(dbUrl.indexOf("//") + 2, dbUrl.lastIndexOf("/"));
        String host = hostPort.contains(":") ? hostPort.split(":")[0] : hostPort;
        String port = hostPort.contains(":") ? hostPort.split(":")[1] : "5432";

        // 3. Find pg_dump path
        String pgDumpPath = findPgDump();
        String fileName = prefix + "_" + LocalDateTime.now().format(FILE_NAME_FMT) + ".sql";
        File outputFile = new File(dir, fileName);

        log.info("Exporting database {} to {}", dbName, outputFile.getAbsolutePath());

        // 4. Build command
        ProcessBuilder pb = new ProcessBuilder(
                pgDumpPath,
                "-h", host,
                "-p", port,
                "-U", dbUser,
                "-F", "p", // plain text format
                "-f", outputFile.getAbsolutePath(),
                dbName);

        // Set password via environment variable to avoid prompt
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.directory(new File(pgDumpPath).getParentFile());

        Process process = pb.start();
        int exitCode = process.waitFor();

        if (exitCode == 0) {
            log.info("Database export successful: {}", fileName);
            copyToCloudBackupPaths(outputFile, fileName);
            return fileName;
        } else {
            String error = new String(process.getErrorStream().readAllBytes());
            log.error("Database export failed with exit code {}: {}", exitCode, error);
            throw new IOException("pg_dump failed: " + error);
        }
    }

    public List<String> listBackups() {
        File dir = new File(BACKUP_DIR);
        if (!dir.exists())
            return new ArrayList<>();
        File[] files = dir.listFiles((d, name) -> name.endsWith(".sql"));
        if (files == null)
            return new ArrayList<>();
        return Arrays.stream(files)
                .map(File::getName)
                .sorted((a, b) -> b.compareTo(a)) // Latest first
                .collect(Collectors.toList());
    }

    private String findPgDump() {
        // 1. Try system PATH first (most likely to match user's installed server
        // version in dev)
        try {
            Process p = Runtime.getRuntime().exec("pg_dump --version");
            if (p.waitFor() == 0) {
                log.info("Using system pg_dump found in PATH");
                return "pg_dump";
            }
        } catch (Exception e) {
            log.debug("System pg_dump not found or not working: {}", e.getMessage());
        }

        // 2. Try property passed from Electron (for production)
        String propertyPath = System.getProperty("PG_BIN_DIR");
        log.info("Checking PG_BIN_DIR property: {}", propertyPath);
        if (propertyPath != null && !propertyPath.isEmpty()) {
            File f = new File(propertyPath, "pg_dump.exe");
            if (f.exists()) {
                log.info("Found pg_dump.exe in property path: {}", f.getAbsolutePath());
                return f.getAbsolutePath();
            }

            f = new File(propertyPath, "pg_dump");
            if (f.exists()) {
                log.info("Found pg_dump in property path: {}", f.getAbsolutePath());
                return f.getAbsolutePath();
            }
        }

        // 3. Try scanning C:\Program Files\PostgreSQL dynamically
        File pgRoot = new File("C:/Program Files/PostgreSQL");
        if (pgRoot.exists() && pgRoot.isDirectory()) {
            File[] versions = pgRoot.listFiles();
            if (versions != null) {
                // Sort versions descending (try newest first)
                java.util.Arrays.sort(versions, (a, b) -> b.getName().compareTo(a.getName()));
                for (File v : versions) {
                    File dump = new File(v, "bin/pg_dump.exe");
                    if (dump.exists()) {
                        log.info("Found system pg_dump via scan: {}", dump.getAbsolutePath());
                        return dump.getAbsolutePath();
                    }
                }
            }
        }

        // 4. Try common Windows installation paths (hardcoded as backup)
        String[] commonInstallPaths = {
                "C:/Program Files/PostgreSQL/18/bin/pg_dump.exe",
                "C:/Program Files/PostgreSQL/17/bin/pg_dump.exe",
                "C:/Program Files/PostgreSQL/16/bin/pg_dump.exe",
                "C:/Program Files/PostgreSQL/15/bin/pg_dump.exe"
        };
        for (String p : commonInstallPaths) {
            File f = new File(p);
            if (f.exists()) {
                log.info("Found system pg_dump at: {}", f.getAbsolutePath());
                return f.getAbsolutePath();
            }
        }

        // 5. Try typical relative paths
        String[] possiblePaths = {
                "pgsql/bin/pg_dump.exe",
                "../pgsql/bin/pg_dump.exe",
                "../web/pgsql/bin/pg_dump.exe",
                "../../pgsql/bin/pg_dump.exe",
                "bin/pg_dump.exe",
                "pg_dump.exe"
        };

        for (String p : possiblePaths) {
            File f = new File(p);
            log.info("Checking relative path: {} -> {}", p, f.getAbsolutePath());
            if (f.exists()) {
                log.info("Found pg_dump at relative path: {}", f.getAbsolutePath());
                return f.getAbsolutePath();
            }
        }

        // 5. Final Fallback
        log.warn("pg_dump not found in known locations, falling back to system PATH (last resort)");
        return "pg_dump";
    }

    private void copyToCloudBackupPaths(File outputFile, String fileName) {
        try {
            List<com.probloom.model.entity.User> activeUsers = userRepository.findActiveUsersWithCloudBackupPath();
            if (activeUsers == null || activeUsers.isEmpty()) {
                return;
            }
            log.info("Found {} active user(s) with cloud backup paths configured.", activeUsers.size());
            for (com.probloom.model.entity.User u : activeUsers) {
                String pathStr = u.getCloudBackupPath();
                if (pathStr != null && !pathStr.trim().isEmpty()) {
                    File cloudDir = new File(pathStr.trim());
                    if (!cloudDir.exists()) {
                        log.info("Creating cloud backup directory: {}", cloudDir.getAbsolutePath());
                        cloudDir.mkdirs();
                    }
                    if (cloudDir.exists() && cloudDir.isDirectory()) {
                        File destFile = new File(cloudDir, fileName);
                        java.nio.file.Files.copy(
                                outputFile.toPath(),
                                destFile.toPath(),
                                java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        log.info("Copied backup successfully to cloud path: {} for user {}", destFile.getAbsolutePath(),
                                u.getEmail());
                    } else {
                        log.warn("Cloud backup path could not be created or is not a directory: {}", pathStr);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to copy database backup to cloud paths", e);
        }
    }
}
