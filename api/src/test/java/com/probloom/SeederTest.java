package com.probloom;

import com.probloom.model.entity.User;
import com.probloom.model.entity.StakeholderMapping;
import com.probloom.repository.UserRepository;
import com.probloom.repository.StakeholderMappingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.stream.Collectors;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest

public class SeederTest {

    @MockBean
    private SocketIOServer socketIOServer;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StakeholderMappingRepository stakeholderMappingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    public void seedStakeholders() {
        System.out.println("====== STARTING STAKEHOLDER SEED ======");

        // 1. Ensure the accounts exist with correct passwords and roles
        User stakeholder1 = ensureUser("9710082916", "Madhavan Global Investor", "Madhavan001@");
        User stakeholder2 = ensureUser("7401813016", "Madhavan Regional Investor", "Madhavan001@");

        // Fetch all owners
        List<User> owners = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.OWNER)
                .collect(Collectors.toList());

        System.out.println("Found " + owners.size() + " Owner Restaurants in system.");
        for (User o : owners)
            System.out.println(" - " + o.getRestaurantName() + " (ID: " + o.getId() + ")");

        // 2. Clear previous mappings to avoid duplicates or stale data for these
        // specific users
        stakeholderMappingRepository.findAll().stream()
                .filter(sm -> sm.getStakeholder().getId().equals(stakeholder1.getId()) ||
                        sm.getStakeholder().getId().equals(stakeholder2.getId()))
                .forEach(sm -> stakeholderMappingRepository.delete(sm));

        // 3. Assign Stakeholder 1 to ALL owners
        for (User owner : owners) {
            assign(stakeholder1, owner, 50.0);
        }

        // 4. Assign Stakeholder 2 to Bhavan and KFC owners
        for (User owner : owners) {
            String rName = owner.getRestaurantName() != null ? owner.getRestaurantName().toLowerCase() : "";
            if (rName.contains("bhavan") || rName.contains("kfc")) {
                assign(stakeholder2, owner, 30.0);
            }
        }

        System.out.println("====== SEEDING COMPLETED SUCCESSFULLY ======");
    }

    private User ensureUser(String phone, String name, String password) {
        User user = userRepository.findFirstByPhone(phone).orElse(null);
        if (user == null) {
            user = User.builder()
                    .name(name)
                    .email(phone + "@stakeholder.km")
                    .phone(phone)
                    .password(passwordEncoder.encode(password))
                    .role(User.Role.STAKEHOLDER)
                    .restaurantName("Investor Account")
                    .isActive(true)
                    .onboardingCompleted(true)
                    .build();
            System.out.println("Created new account for: " + phone);
        } else {
            user.setPassword(passwordEncoder.encode(password));
            // Keep role as OWNER if it already was one, otherwise set to STAKEHOLDER
            if (user.getRole() != User.Role.OWNER) {
                user.setRole(User.Role.STAKEHOLDER);
            }
            user.setIsActive(true);
            System.out.println("Updated existing account: " + phone + " (Role: " + user.getRole() + ")");
        }
        return userRepository.save(user);
    }

    private void assign(User stakeholder, User owner, double percentage) {
        StakeholderMapping sm = new StakeholderMapping();
        sm.setStakeholder(stakeholder);
        sm.setRestaurant(owner);
        sm.setSharePercentage(percentage);
        sm.setIsActive(true);
        stakeholderMappingRepository.save(sm);
        System.out.println("Mapped " + stakeholder.getPhone() + " to " + owner.getRestaurantName());
    }
}
