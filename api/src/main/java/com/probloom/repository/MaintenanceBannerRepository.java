package com.probloom.repository;

import com.probloom.model.entity.MaintenanceBanner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MaintenanceBannerRepository extends JpaRepository<MaintenanceBanner, Long> {

    /**
     * Returns the first active banner whose time window contains the given moment
     */
    @Query("SELECT b FROM MaintenanceBanner b WHERE b.isActive = true AND b.fromTime <= :now AND b.toTime >= :now ORDER BY b.createdAt DESC")
    Optional<MaintenanceBanner> findActiveBannerAt(@Param("now") LocalDateTime now);

    List<MaintenanceBanner> findAllByOrderByCreatedAtDesc();
}
