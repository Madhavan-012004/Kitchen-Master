package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.MenuItem;
import com.probloom.model.entity.User;
import com.probloom.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.lang.NonNull;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@RestController
@RequestMapping("/api/menu")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;
    private final CurrentUserResolver resolver;
    private final com.probloom.repository.UserRepository userRepository;

    @GetMapping("/public/{restaurantId}")
    public ResponseEntity<?> getPublicMenu(@PathVariable("restaurantId") String restaurantIdStr,
                                          @RequestParam(name = "category", required = false) String category) {
        try {
            Long restaurantId = Long.valueOf(restaurantIdStr);
            User restaurant = userRepository.findById(java.util.Objects.requireNonNull(restaurantId))
                    .orElseThrow(() -> new com.probloom.exception.ResourceNotFoundException("Restaurant not found (ID: " + restaurantId + ")"));
            List<MenuItem> items = menuService.getAll(java.util.Objects.requireNonNull(restaurant), category, true);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("items", items != null ? items : List.of());
            data.put("count", items != null ? items.size() : 0);
            return ok("Menu fetched", data);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid Restaurant ID format"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/public/{restaurantId}/categories")
    public ResponseEntity<?> getPublicCategories(@PathVariable("restaurantId") String restaurantIdStr) {
        try {
            Long restaurantId = Long.valueOf(restaurantIdStr);
            User restaurant = userRepository.findById(java.util.Objects.requireNonNull(restaurantId))
                    .orElseThrow(() -> new com.probloom.exception.ResourceNotFoundException("Restaurant not found (ID: " + restaurantId + ")"));
            List<String> categories = menuService.getCategories(java.util.Objects.requireNonNull(restaurant));
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("categories", categories != null ? categories : List.of());
            return ok("Categories fetched", data);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid Restaurant ID format"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(name = "category", required = false) String category,
                                    @RequestParam(name = "availableOnly", required = false) Boolean availableOnly) {
        User restaurant = resolver.getRestaurantOwner();
        List<MenuItem> items = menuService.getAll(restaurant, category, availableOnly);
        return ok("Menu fetched", Map.of("items", items, "count", items.size()));
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Categories fetched", Map.of("categories", menuService.getCategories(restaurant)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Menu item fetched", menuService.getById(restaurant, id));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Menu item created", menuService.create(restaurant, body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Menu item updated", menuService.update(restaurant, id, body));
    }

    @PostMapping("/import")
    public ResponseEntity<?> importBulk(@RequestParam("file") @NonNull MultipartFile file) {
        try {
            User restaurant = resolver.getRestaurantOwner();
            int count = menuService.importBulk(restaurant, file);
            return ok("Imported " + count + " items successfully", Map.of("count", count));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Import failed: " + e.getMessage(),
                "details", e.getClass().getName()
            ));
        }
    }

    @PostMapping("/{id}/image")
    public ResponseEntity<?> uploadImage(
            @PathVariable("id") @NonNull Long id,
            @RequestParam("file") @NonNull MultipartFile file) {
        try {
            User restaurant = resolver.getRestaurantOwner();
            // Ensure uploads directory exists
            String uploadDir = "uploads/menu";
            Path dirPath = Paths.get(uploadDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }
            // Save file with unique name
            String originalFilename = file.getOriginalFilename();
            String ext = (originalFilename != null && originalFilename.contains("."))
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : ".jpg";
            String filename = "menu_" + id + "_" + UUID.randomUUID().toString().substring(0, 8) + ext;
            Path filePath = dirPath.resolve(filename);
            Files.write(filePath, file.getBytes());
            // Update menu item imageUrl
            String imageUrl = "/uploads/menu/" + filename;
            MenuItem updated = menuService.setImageUrl(restaurant, id, imageUrl);
            return ok("Image uploaded", Map.of("imageUrl", imageUrl, "item", updated));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Image upload failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        menuService.delete(restaurant, id);
        return ok("Menu item deleted", null);
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<?> toggleAvailability(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        MenuItem updated = menuService.toggleAvailability(restaurant, id);
        return ok("Item availability updated", updated);
    }

    @DeleteMapping("/all")
    public ResponseEntity<?> deleteAll() {
        try {
            User restaurant = resolver.getRestaurantOwner();
            menuService.deleteAll(restaurant);
            return ok("All menu items deleted successfully", null);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "message", "Delete All failed: " + e.getMessage(),
                "details", e.getClass().getName()
            ));
        }
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
