package com.probloom.repository;

import com.probloom.model.entity.MenuItem;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    List<MenuItem> findByRestaurantOrderBySortOrderAsc(@Param("restaurant") User restaurant);
    List<MenuItem> findByRestaurantAndIsAvailableTrueOrderBySortOrderAsc(@Param("restaurant") User restaurant);
    List<MenuItem> findByRestaurantAndCategoryOrderBySortOrderAsc(@Param("restaurant") User restaurant, @Param("category") String category);
    List<MenuItem> findByRestaurantAndIsAvailableTrueAndCategoryOrderBySortOrderAsc(@Param("restaurant") User restaurant, @Param("category") String category);
    List<String> findDistinctCategoryByRestaurant(@Param("restaurant") User restaurant);
    
    @org.springframework.transaction.annotation.Transactional
    void deleteByRestaurant(User restaurant);
}
