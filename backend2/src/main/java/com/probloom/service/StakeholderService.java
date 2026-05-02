package com.probloom.service;

import com.probloom.exception.BadRequestException;
import com.probloom.exception.ResourceNotFoundException;
import com.probloom.exception.UnauthorizedException;
import com.probloom.model.entity.StakeholderMapping;
import com.probloom.model.entity.User;
import com.probloom.repository.StakeholderMappingRepository;
import com.probloom.repository.UserRepository;
import com.probloom.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;

import java.util.*;
import java.util.stream.Collectors;
import java.util.Objects;

/**
 * Handles all stakeholder (multi-restaurant investor) operations:
 *  - Phone-based stakeholder login
 *  - Inviting / removing stakeholders by restaurant owners
 *  - Listing accessible restaurants for a stakeholder
 *  - Security validation of X-Restaurant-Id header
 */
@Service
public class StakeholderService {

    @Autowired private UserRepository userRepository;
    @Autowired private StakeholderMappingRepository stakeholderMappingRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtUtil jwtUtil;

    // ── LOGIN ────────────────────────────────────────────────────────────────

    /**
     * Stakeholder phone login.
     * 1. Finds (or auto-creates) a STAKEHOLDER user by phone.
     * 2. Validates password.
     * 3. Returns token + list of accessible restaurants.
     */
    public Map<String, Object> stakeholderLogin(String phone, String password) {
        if (phone == null || phone.isBlank()) throw new BadRequestException("Phone number is required");
        if (password == null || password.isBlank()) throw new BadRequestException("Password is required");

        User user = userRepository.findFirstByPhone(phone.trim())
                .orElseThrow(() -> new BadRequestException("No stakeholder account found for this phone number. Ask your restaurant owner to invite you first."));

        // Allow STAKEHOLDER and OWNER roles to use this portal
        if (user.getRole() != User.Role.STAKEHOLDER && user.getRole() != User.Role.OWNER) {
            throw new BadRequestException("This phone number is registered as a " + user.getRole().name().toLowerCase() + ", not a stakeholder.");
        }

        if (!user.getIsActive()) throw new BadRequestException("Your account has been deactivated.");

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("Invalid phone number or password.");
        }

        return buildStakeholderAuthResponse(user);
    }

    // ── INVITE ───────────────────────────────────────────────────────────────

    /**
     * Owner invites a stakeholder by phone number.
     * - If phone already has a STAKEHOLDER user: link to this restaurant.
     * - Else: create a new STAKEHOLDER user with the supplied password, then link.
     */
    public Map<String, Object> inviteStakeholder(@NonNull User owner, String phone, String name,
                                                  String password, Double sharePercentage) {
        if (phone == null || phone.isBlank()) throw new BadRequestException("Phone number is required");
        if (name == null || name.isBlank()) throw new BadRequestException("Stakeholder name is required");

        phone = phone.trim();

        // Check if phone belongs to an active restaurant owner / staff (not allowed as stakeholder)
        Optional<User> existingByPhone = userRepository.findFirstByPhone(phone);
        User stakeholder;

        if (existingByPhone.isPresent()) {
            stakeholder = existingByPhone.get();
            if (stakeholder.getRole() != User.Role.STAKEHOLDER) {
                throw new BadRequestException("Phone number " + phone + " is already registered as a " + stakeholder.getRole().name().toLowerCase() + " user. Stakeholders must have a dedicated account.");
            }
        } else {
            // Auto-generate email placeholder; real login is via phone
            String fakeEmail = "stakeholder_" + phone.replaceAll("[^0-9]", "") + "@stakeholder.km";
            if (password == null || password.isBlank()) throw new BadRequestException("Password is required for new stakeholders");

            stakeholder = new User();
            stakeholder.setName(name);
            stakeholder.setPhone(phone);
            stakeholder.setEmail(fakeEmail);
            stakeholder.setPassword(passwordEncoder.encode(password));
            stakeholder.setRole(User.Role.STAKEHOLDER);
            stakeholder.setRestaurantName("Stakeholder"); // placeholder
            stakeholder.setIsActive(true);
            stakeholder.setOnboardingCompleted(true);
            stakeholder = Objects.requireNonNull(userRepository.save(stakeholder));
        }

        // Check for duplicate mapping
        Optional<StakeholderMapping> existing = stakeholderMappingRepository.findByStakeholderAndRestaurant(stakeholder, owner);
        if (existing.isPresent()) {
            StakeholderMapping m = existing.get();
            if (m.getIsActive()) {
                throw new BadRequestException("This stakeholder is already linked to your restaurant.");
            } else {
                // Re-activate
                m.setIsActive(true);
                m.setSharePercentage(sharePercentage != null ? sharePercentage : 0.0);
                Objects.requireNonNull(stakeholderMappingRepository.save(m));
            }
        } else {
            StakeholderMapping mapping = new StakeholderMapping();
            mapping.setStakeholder(stakeholder);
            mapping.setRestaurant(owner);
            mapping.setSharePercentage(sharePercentage != null ? sharePercentage : 0.0);
            mapping.setIsActive(true);
            Objects.requireNonNull(stakeholderMappingRepository.save(mapping));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("stakeholderId", stakeholder.getId());
        result.put("name", stakeholder.getName());
        result.put("phone", stakeholder.getPhone());
        result.put("sharePercentage", sharePercentage != null ? sharePercentage : 0.0);
        result.put("message", "Stakeholder " + stakeholder.getName() + " successfully linked to " + owner.getRestaurantName());
        return result;
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────

    public void removeStakeholder(@NonNull User owner, @NonNull Long stakeholderId) {
        User stakeholder = userRepository.findById(stakeholderId)
                .orElseThrow(() -> new ResourceNotFoundException("Stakeholder not found"));

        StakeholderMapping mapping = stakeholderMappingRepository
                .findByStakeholderAndRestaurant(stakeholder, owner)
                .orElseThrow(() -> new BadRequestException("This stakeholder is not linked to your restaurant."));

        mapping.setIsActive(false);
        Objects.requireNonNull(stakeholderMappingRepository.save(mapping));
    }

    // ── LIST ─────────────────────────────────────────────────────────────────

    /** For owner: list all stakeholders on their restaurant */
    public List<Map<String, Object>> getRestaurantStakeholders(@NonNull User owner) {
        return stakeholderMappingRepository.findByRestaurantAndIsActiveTrue(owner)
                .stream()
                .map(m -> {
                    Map<String, Object> s = new HashMap<>();
                    s.put("id", m.getId());
                    s.put("stakeholderId", m.getStakeholder().getId());
                    s.put("name", m.getStakeholder().getName());
                    s.put("phone", m.getStakeholder().getPhone());
                    s.put("sharePercentage", m.getSharePercentage());
                    s.put("assignedAt", m.getAssignedAt());
                    return s;
                })
                .collect(Collectors.toList());
    }

    /** For stakeholder: list all accessible restaurants */
    public List<Map<String, Object>> getAccessibleRestaurants(@NonNull User user) {
        List<Map<String, Object>> list = new ArrayList<>();

        // 1. If user is an OWNER, include their own restaurant
        if (user.getRole() == User.Role.OWNER) {
            Map<String, Object> own = new HashMap<>();
            own.put("restaurantId", user.getId());
            own.put("restaurantName", user.getRestaurantName());
            own.put("ownerName", user.getName());
            own.put("logo", user.getLogo());
            own.put("address", user.getAddress());
            own.put("sharePercentage", 100.0);
            list.add(own);
        }

        // 2. Add all mapped restaurants (stakeholder shares)
        List<Map<String, Object>> mapped = stakeholderMappingRepository.findByStakeholderAndIsActiveTrue(user)
                .stream()
                .map(m -> {
                    User r = m.getRestaurant();
                    Map<String, Object> info = new HashMap<>();
                    info.put("restaurantId", r.getId());
                    info.put("restaurantName", r.getRestaurantName());
                    info.put("ownerName", r.getName());
                    info.put("logo", r.getLogo());
                    info.put("address", r.getAddress());
                    info.put("sharePercentage", m.getSharePercentage());
                    return info;
                })
                .collect(Collectors.toList());
        
        list.addAll(mapped);

        // Deduplicate in case an owner is mapped to themselves
        Map<Long, Map<String, Object>> unique = new LinkedHashMap<>();
        for (Map<String, Object> item : list) {
            unique.put((Long) item.get("restaurantId"), item);
        }

        return new ArrayList<>(unique.values());
    }

    // ── SECURITY ─────────────────────────────────────────────────────────────

    /**
     * Securely resolves the effective restaurant owner list for a stakeholder, 
     * given a requested restaurant ID from the X-Restaurant-Id header.
     *
     * Returns a List of validated owner User objects.
     * - If requestedId is "ALL" → returns ALL accessible restaurant owners.
     * - If the user is not a stakeholder → falls back to their own restaurant owner.
     */
    public List<User> resolveAllowedRestaurants(@NonNull User currentUser, String xRestaurantId) {
        List<Long> accessibleIds = new ArrayList<>();
        
        // 1. If user is an OWNER, their own restaurant is always accessible
        if (currentUser.getRole() == User.Role.OWNER) {
            accessibleIds.add(currentUser.getId());
        } else if (currentUser.getRole() != User.Role.STAKEHOLDER) {
            // STAFF: restricted to their parent owner only.
            User owner = (currentUser.getRole() == User.Role.OWNER) ? currentUser : currentUser.getParentOwner();
            if (owner == null) throw new UnauthorizedException("Cannot determine restaurant context");
            return List.of(owner);
        }

        // 2. Add mapped restaurants (external shares)
        accessibleIds.addAll(stakeholderMappingRepository.findRestaurantIdsByStakeholderId(currentUser.getId()));

        if (accessibleIds.isEmpty()) {
            throw new UnauthorizedException("You have no restaurants assigned to your account.");
        }

        if (xRestaurantId == null || xRestaurantId.isBlank() || xRestaurantId.equalsIgnoreCase("ALL")) {
            // Return all unique accessible restaurant owner accounts
            return userRepository.findAllById(Objects.requireNonNull(accessibleIds.stream().distinct().collect(Collectors.toList())));
        }

        // Specific restaurant requested — validate access
        try {
            Long requestedId = Long.parseLong(xRestaurantId);
            if (!accessibleIds.contains(requestedId)) {
                throw new UnauthorizedException("Access denied: you do not have permission on restaurant ID " + requestedId);
            }
            return List.of(userRepository.findById(requestedId)
                    .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found: " + requestedId)));
        } catch (NumberFormatException e) {
            throw new BadRequestException("Invalid X-Restaurant-Id header value: " + xRestaurantId);
        }
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private Map<String, Object> buildStakeholderAuthResponse(User stakeholder) {
        String token = jwtUtil.generateToken(
                String.valueOf(stakeholder.getId()),
                stakeholder.getRole().name(),
                0L  // No single restaurant owner; resolved dynamically per request
        );

        List<Map<String, Object>> restaurants = getAccessibleRestaurants(stakeholder);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("_id", stakeholder.getId());
        userMap.put("id", stakeholder.getId());
        userMap.put("name", stakeholder.getName());
        userMap.put("phone", stakeholder.getPhone());
        userMap.put("email", stakeholder.getEmail());
        userMap.put("role", "stakeholder"); // Tell UI to use stakeholder mode
        userMap.put("actualRole", stakeholder.getRole().name().toLowerCase());
        userMap.put("isProBloomAdmin", false);
        userMap.put("onboardingCompleted", true);
        userMap.put("accessibleRestaurants", restaurants);

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("user", userMap);
        return data;
    }
}
