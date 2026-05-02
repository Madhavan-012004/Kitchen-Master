package com.probloom.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            System.out.println("🛠️ [Database] Checking for role constraints...");
            // Drop the old constraint to allow new CUSTOMER role
            jdbcTemplate.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;");
            System.out.println("✅ [Database] Role constraints updated successfully.");
        } catch (Exception e) {
            System.err.println("⚠️ [Database] Could not update constraints (this is normal if it already exists): " + e.getMessage());
        }
    }
}
