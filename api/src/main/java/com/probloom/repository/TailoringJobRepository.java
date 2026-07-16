package com.probloom.repository;

import com.probloom.model.entity.TailoringJob;
import com.probloom.model.entity.TailoringJob.TailoringStatus;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TailoringJobRepository extends JpaRepository<TailoringJob, Long> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"restaurant", "createdBy"})
    List<TailoringJob> findByRestaurantOrderByCreatedAtDesc(User restaurant);
    
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"restaurant", "createdBy"})
    List<TailoringJob> findByRestaurantAndStatusOrderByCreatedAtDesc(User restaurant, TailoringStatus status);
    Optional<TailoringJob> findByRestaurantAndTokenNumber(User restaurant, String tokenNumber);
    List<TailoringJob> findByRestaurantAndCustomerPhoneOrderByCreatedAtDesc(User restaurant, String phone);
    List<TailoringJob> findByRestaurantAndDeliveryDateOrderByCreatedAtAsc(User restaurant, LocalDate deliveryDate);

    @Query("SELECT COUNT(j) FROM TailoringJob j WHERE j.restaurant = :restaurant AND j.status = :status")
    long countByRestaurantAndStatus(@Param("restaurant") User restaurant, @Param("status") TailoringStatus status);

    @Query("SELECT COUNT(j) FROM TailoringJob j WHERE j.restaurant = :restaurant " +
           "AND FUNCTION('DATE', j.createdAt) = :today AND FUNCTION('SUBSTR', j.tokenNumber, 3, 8) = :dateStr")
    long countTodayJobsByRestaurant(@Param("restaurant") User restaurant,
                                    @Param("today") LocalDate today,
                                    @Param("dateStr") String dateStr);
}
