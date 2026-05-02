package com.probloom.config;

import com.probloom.exception.UnauthorizedException;
import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import com.probloom.service.StakeholderService;
import org.springframework.lang.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class CurrentUserResolver {

    private final UserRepository userRepository;
    private final StakeholderService stakeholderService;

    /**
     * Returns the currently authenticated user from the SecurityContext.
     */
    @NonNull
    public User getCurrentUser() {
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) throw new UnauthorizedException("Not authenticated");
        Long userId = Long.parseLong(auth.getPrincipal().toString());
        return Objects.requireNonNull(
                userRepository.findById(userId)
                        .orElseThrow(() -> new UnauthorizedException("User not found"))
        );
    }

    /**
     * Returns the restaurant owner User for single-tenant operations.
     * - If current user is OWNER → return self.
     * - If current user is STAFF → return parentOwner.
     * - If current user is STAKEHOLDER → throw (use resolveAllowedRestaurants instead).
     */
    @NonNull
    public User getRestaurantOwner() {
        User current = getCurrentUser();
        if (current.getRole() == User.Role.STAKEHOLDER) {
            throw new UnauthorizedException("Stakeholder accounts must specify X-Restaurant-Id header for data access.");
        }
        if (current.getRole() == User.Role.OWNER) return current;
        User parentOwner = current.getParentOwner();
        if (parentOwner != null) return Objects.requireNonNull(parentOwner);
        throw new UnauthorizedException("Cannot determine restaurant owner");
    }

    /**
     * Multi-tenant resolution for stakeholders.
     * Reads the X-Restaurant-Id header and securely resolves which restaurant owner(s) to use.
     *
     * - For OWNER/STAFF: delegates to getRestaurantOwner() (ignores header, single tenant)
     * - For STAKEHOLDER with header "ALL": returns all allowed restaurant owners
     * - For STAKEHOLDER with specific ID: validates access and returns that one owner
     *
     * All callers in tenant-aware controllers (Analytics, Inventory, Attendance, Staff) use this.
     */
    public List<User> resolveAllowedRestaurants(String xRestaurantIdHeader) {
        User current = getCurrentUser();
        return stakeholderService.resolveAllowedRestaurants(current, xRestaurantIdHeader);
    }

    /**
     * Convenience: resolves a single restaurant owner for controllers that handle
     * single-record operations (not aggregated). Throws if more than one is resolved.
     */
    @NonNull
    public User resolveSingleRestaurant(String xRestaurantIdHeader) {
        User current = getCurrentUser();
        if (current.getRole() != User.Role.STAKEHOLDER) {
            return getRestaurantOwner();
        }
        List<User> resolved = stakeholderService.resolveAllowedRestaurants(current, xRestaurantIdHeader);
        if (resolved.size() != 1) {
            throw new com.probloom.exception.BadRequestException("This operation requires a specific restaurant. Set X-Restaurant-Id header to a specific restaurant ID.");
        }
        return Objects.requireNonNull(resolved.get(0));
    }
}
