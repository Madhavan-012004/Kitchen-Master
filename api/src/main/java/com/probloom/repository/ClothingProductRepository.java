package com.probloom.repository;

import com.probloom.model.entity.ClothingProduct;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClothingProductRepository extends JpaRepository<ClothingProduct, Long> {
    List<ClothingProduct> findByRestaurantAndIsActiveTrueOrderByBrandAscMaterialTypeAsc(User restaurant);
    List<ClothingProduct> findByRestaurantOrderByBrandAscMaterialTypeAsc(User restaurant);
    List<ClothingProduct> findByRestaurantAndBrandIgnoreCaseOrderByMaterialTypeAsc(User restaurant, String brand);
    long countByRestaurantAndIsActiveTrue(User restaurant);
}
