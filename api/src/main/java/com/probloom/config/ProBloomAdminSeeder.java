package com.probloom.config;

import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class ProBloomAdminSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${PROBLOOM_ADMIN_EMAIL:admin@probloom.com}")
    private String adminEmail;

    @Value("${PROBLOOM_ADMIN_PASSWORD:ProBloom@2025!}")                                                                                                 
    private String adminPassword;

    @Value("${PROBLOOM_ADMIN_NAME:ProBloom Admin}")
    private String adminName;

    @Override
    public void run(String... args) throws Exception {
        // Fix database constraint issue for CANCELLED status
        try {
            System.out.println("\n🌸 [ProBloom] Patching database constraints for Order Items...");
            jdbcTemplate.execute("ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check");
            System.out.println("✅ Database constraint 'order_items_status_check' patched.\n");
        } catch (Exception e) {
            System.err.println("⚠️ Could not patch database constraint: " + e.getMessage());
        }

        if (!userRepository.existsByEmail(adminEmail)) {
            System.out.println("\n🌸 [ProBloom] Creating Super Admin Account...");
            User admin = User.builder()
                    .name(adminName)
                    .email(adminEmail)
                    .password(passwordEncoder.encode(adminPassword))
                    .restaurantName("ProBloom HQ")
                    .role(User.Role.OWNER)
                    .isProBloomAdmin(true)
                    .isActive(true)
                    .onboardingCompleted(true)
                    .build();

            admin.setSubscriptionPlan(User.SubscriptionPlan.ENTERPRISE);
            admin.setSubscriptionStartedAt(LocalDateTime.now());
            // Give 100 years of access
            admin.setSubscriptionExpiresAt(LocalDateTime.now().plusYears(100));

            userRepository.save(admin);
            System.out.println("✅ ProBloom Admin created.");
            System.out.println("   Email: " + adminEmail);
            System.out.println("   Dashboard: /probloom-hq\n");
        } else {
            // Check if existing user is missing admin flag and fix it
            User admin = userRepository.findByEmail(adminEmail).orElse(null);
            if (admin != null && !Boolean.TRUE.equals(admin.getIsProBloomAdmin())) {
                admin.setIsProBloomAdmin(true);
                admin.setSubscriptionExpiresAt(LocalDateTime.now().plusYears(100));
                userRepository.save(admin);
                System.out.println("\n✅ [ProBloom] Upgraded existing " + adminEmail + " account to Super Admin.\n");
            }
        }
    }
}
