package com.probloom.repository;

import com.probloom.model.entity.ClothingProduct;
import com.probloom.model.entity.ClothingVariant;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClothingVariantRepository extends JpaRepository<ClothingVariant, Long> {
    List<ClothingVariant> findByClothingProductAndIsActiveTrueOrderByColorAscSizeAsc(ClothingProduct product);
    List<ClothingVariant> findByRestaurantAndIsActiveTrueOrderByColorAsc(User restaurant);
    Optional<ClothingVariant> findByRestaurantAndSku(User restaurant, String sku);
    Optional<ClothingVariant> findByRestaurantAndBarcode(User restaurant, String barcode);

    @Query("SELECT v FROM ClothingVariant v WHERE v.restaurant = :restaurant AND v.isActive = true " +
           "AND (LOWER(v.color) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(v.size) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(v.sku) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(v.barcode) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<ClothingVariant> searchVariants(@Param("restaurant") User restaurant, @Param("q") String query);

    @Query("SELECT v FROM ClothingVariant v WHERE v.restaurant = :restaurant AND v.isActive = true AND v.mainStock <= v.lowStockThreshold")
    List<ClothingVariant> findLowStockVariants(@Param("restaurant") User restaurant);

    long countByRestaurantAndIsActiveTrue(User restaurant);
}
