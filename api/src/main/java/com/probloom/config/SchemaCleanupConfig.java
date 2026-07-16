package com.probloom.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Slf4j
public class SchemaCleanupConfig {

    @Bean
    public CommandLineRunner dropStaleUniqueConstraint(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                // Drop the stale global unique constraint on order_number
                // This constraint prevents different restaurants from starting their sequences at ORD0001
                String constraintName = "uk_nthkiu7pgmnqnu86i2jyoe2v7";
                log.info("Checking for stale constraint: {}", constraintName);
                
                jdbcTemplate.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS " + constraintName);
                jdbcTemplate.execute("ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_unit_check");
                
                log.info("Successfully checked/dropped stale constraint: {}", constraintName);
            } catch (Exception e) {
                log.warn("Could not drop constraint (it might already be gone): {}", e.getMessage());
            }
        };
    }
}
