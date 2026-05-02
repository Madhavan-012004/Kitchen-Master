package com.probloom.repository;

import com.probloom.model.entity.StakeholderMapping;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StakeholderMappingRepository extends JpaRepository<StakeholderMapping, Long> {

    /** All active mappings for a stakeholder — used to list accessible restaurants at login */
    List<StakeholderMapping> findByStakeholderAndIsActiveTrue(User stakeholder);

    /** All active stakeholders for a given restaurant — used by owner to see their investors */
    List<StakeholderMapping> findByRestaurantAndIsActiveTrue(User restaurant);

    /** Check if a specific mapping already exists */
    Optional<StakeholderMapping> findByStakeholderAndRestaurant(User stakeholder, User restaurant);

    /** Fetch stakeholder IDs (restaurant owner IDs) that a stakeholder has access to */
    @Query("SELECT sm.restaurant.id FROM StakeholderMapping sm WHERE sm.stakeholder.id = :stakeholderId AND sm.isActive = true")
    List<Long> findRestaurantIdsByStakeholderId(@Param("stakeholderId") Long stakeholderId);

    /** Verify a stakeholder has access to a specific restaurant */
    @Query("SELECT COUNT(sm) > 0 FROM StakeholderMapping sm WHERE sm.stakeholder.id = :stakeholderId AND sm.restaurant.id = :restaurantId AND sm.isActive = true")
    boolean existsActiveMapping(@Param("stakeholderId") Long stakeholderId, @Param("restaurantId") Long restaurantId);
}
