package com.probloom.service;

import com.probloom.model.entity.ClothingProduct;
import com.probloom.model.entity.ClothingVariant;
import com.probloom.model.entity.User;
import com.probloom.repository.ClothingProductRepository;
import com.probloom.repository.ClothingVariantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@SuppressWarnings("null")
public class ClothingService {

    @Autowired
    private ClothingProductRepository productRepo;
    @Autowired
    private ClothingVariantRepository variantRepo;

    // ── Products ──────────────────────────────────────────────────────────────

    public List<ClothingProduct> getProducts(User restaurant) {
        return productRepo.findByRestaurantAndIsActiveTrueOrderByBrandAscMaterialTypeAsc(restaurant);
    }

    @Transactional
    public ClothingProduct createProduct(User restaurant, Map<String, Object> body) {
        ClothingProduct p = new ClothingProduct();
        p.setRestaurant(restaurant);
        p.setBrand((String) body.get("brand"));
        p.setMaterialType((String) body.get("materialType"));
        p.setDescription((String) body.get("description"));
        if (body.get("basePrice") != null)
            p.setBasePrice(((Number) body.get("basePrice")).doubleValue());
        if (body.get("gstPercent") != null)
            p.setGstPercent(((Number) body.get("gstPercent")).doubleValue());
        if (body.get("hsnCode") != null)
            p.setHsnCode((String) body.get("hsnCode"));
        return productRepo.save(p);
    }

    @Transactional
    public ClothingProduct updateProduct(Long id, User restaurant, Map<String, Object> body) {
        ClothingProduct p = productRepo.findById(id)
                .filter(pr -> pr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Product not found"));
        if (body.get("brand") != null)
            p.setBrand((String) body.get("brand"));
        if (body.get("materialType") != null)
            p.setMaterialType((String) body.get("materialType"));
        if (body.get("description") != null)
            p.setDescription((String) body.get("description"));
        if (body.get("basePrice") != null)
            p.setBasePrice(((Number) body.get("basePrice")).doubleValue());
        if (body.get("gstPercent") != null)
            p.setGstPercent(((Number) body.get("gstPercent")).doubleValue());
        if (body.get("hsnCode") != null)
            p.setHsnCode((String) body.get("hsnCode"));
        if (body.get("isActive") != null)
            p.setIsActive((Boolean) body.get("isActive"));
        return productRepo.save(p);
    }

    @Transactional
    public void deleteProduct(Long id, User restaurant) {
        ClothingProduct p = productRepo.findById(id)
                .filter(pr -> pr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Product not found"));
        p.setIsActive(false);
        productRepo.save(p);
    }

    // ── Variants ──────────────────────────────────────────────────────────────

    public List<ClothingVariant> getVariantsForProduct(Long productId, User restaurant) {
        ClothingProduct p = productRepo.findById(productId)
                .filter(pr -> pr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Product not found"));
        return variantRepo.findByClothingProductAndIsActiveTrueOrderByColorAscSizeAsc(p);
    }

    public List<ClothingVariant> getAllVariants(User restaurant) {
        return variantRepo.findByRestaurantAndIsActiveTrueOrderByColorAsc(restaurant);
    }

    public List<ClothingVariant> searchVariants(User restaurant, String q) {
        return variantRepo.searchVariants(restaurant, q);
    }

    public List<ClothingVariant> getLowStockVariants(User restaurant) {
        return variantRepo.findLowStockVariants(restaurant);
    }

    @Transactional
    public ClothingVariant createVariant(Long productId, User restaurant, Map<String, Object> body) {
        ClothingProduct product = productRepo.findById(productId)
                .filter(pr -> pr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Product not found"));

        ClothingVariant v = new ClothingVariant();
        v.setClothingProduct(product);
        v.setRestaurant(restaurant);
        v.setColor((String) body.get("color"));
        v.setSize((String) body.get("size"));
        if (body.get("mainStock") != null)
            v.setMainStock(((Number) body.get("mainStock")).intValue());
        if (body.get("subStock") != null)
            v.setSubStock(((Number) body.get("subStock")).intValue());
        if (body.get("costPrice") != null)
            v.setCostPrice(((Number) body.get("costPrice")).doubleValue());
        if (body.get("sellingPrice") != null)
            v.setSellingPrice(((Number) body.get("sellingPrice")).doubleValue());
        if (body.get("lowStockThreshold") != null)
            v.setLowStockThreshold(((Number) body.get("lowStockThreshold")).intValue());
        if (body.get("barcode") != null)
            v.setBarcode((String) body.get("barcode"));

        // Auto-generate SKU if not provided
        String sku = (String) body.get("sku");
        if (sku == null || sku.isEmpty()) {
            sku = generateSku(product.getBrand(), product.getMaterialType(), v.getColor(), v.getSize());
        }
        v.setSku(sku);

        if (v.getMainStock() > 0 || v.getSubStock() > 0)
            v.setLastRestockedAt(LocalDateTime.now());
        return variantRepo.save(v);
    }

    @Transactional
    public ClothingVariant updateVariant(Long variantId, User restaurant, Map<String, Object> body) {
        ClothingVariant v = variantRepo.findById(variantId)
                .filter(vr -> vr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Variant not found"));
        if (body.get("color") != null)
            v.setColor((String) body.get("color"));
        if (body.get("size") != null)
            v.setSize((String) body.get("size"));
        if (body.get("costPrice") != null)
            v.setCostPrice(((Number) body.get("costPrice")).doubleValue());
        if (body.get("sellingPrice") != null)
            v.setSellingPrice(((Number) body.get("sellingPrice")).doubleValue());
        if (body.get("lowStockThreshold") != null)
            v.setLowStockThreshold(((Number) body.get("lowStockThreshold")).intValue());
        if (body.get("barcode") != null)
            v.setBarcode((String) body.get("barcode"));
        if (body.get("isActive") != null)
            v.setIsActive((Boolean) body.get("isActive"));
        return variantRepo.save(v);
    }

    @Transactional
    public ClothingVariant restock(Long variantId, User restaurant, Map<String, Object> body) {
        ClothingVariant v = variantRepo.findById(variantId)
                .filter(vr -> vr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Variant not found"));
        if (body.get("quantity") == null)
            throw new RuntimeException("Quantity is required");
        int qty = ((Number) body.get("quantity")).intValue();
        String target = (String) body.getOrDefault("target", "main");
        if ("sub".equalsIgnoreCase(target)) {
            v.setSubStock(v.getSubStock() + qty);
        } else {
            v.setMainStock(v.getMainStock() + qty);
        }
        v.setLastRestockedAt(LocalDateTime.now());
        return variantRepo.save(v);
    }

    @Transactional
    public ClothingVariant transfer(Long variantId, User restaurant, Map<String, Object> body) {
        ClothingVariant v = variantRepo.findById(variantId)
                .filter(vr -> vr.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Variant not found"));
        if (body.get("quantity") == null)
            throw new RuntimeException("Quantity is required");
        int qty = ((Number) body.get("quantity")).intValue();
        if (v.getSubStock() < qty)
            throw new RuntimeException("Insufficient sub-stock for transfer");
        v.setSubStock(v.getSubStock() - qty);
        v.setMainStock(v.getMainStock() + qty);
        return variantRepo.save(v);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private String generateSku(String brand, String materialType, String color, String size) {
        String b = brand != null ? brand.replaceAll("\\s+", "").toUpperCase().substring(0, Math.min(4, brand.length()))
                : "CLT";
        String m = materialType != null
                ? materialType.replaceAll("\\s+", "").toUpperCase().substring(0, Math.min(3, materialType.length()))
                : "GEN";
        String c = color != null ? color.replaceAll("\\s+", "").toUpperCase().substring(0, Math.min(3, color.length()))
                : "CLR";
        String s = size != null ? size.replaceAll("\\s+", "").toUpperCase() : "OS";
        return b + "-" + m + "-" + c + "-" + s;
    }

    public Map<String, Object> getStats(User restaurant) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProducts", productRepo.countByRestaurantAndIsActiveTrue(restaurant));
        stats.put("totalVariants", variantRepo.countByRestaurantAndIsActiveTrue(restaurant));
        stats.put("lowStockCount", variantRepo.findLowStockVariants(restaurant).size());
        return stats;
    }
}
