package com.probloom.service;

import com.probloom.exception.*;
import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final OrderItemRepository orderItemRepository;

    public List<MenuItem> getAll(@NonNull User restaurant, String category, Boolean availableOnly) {
        List<MenuItem> items;
        if (category != null && !category.isEmpty()) {
            if (Boolean.TRUE.equals(availableOnly)) {
                items = menuItemRepository.findByRestaurantAndIsAvailableTrueAndCategoryOrderBySortOrderAsc(restaurant, category);
            } else {
                items = menuItemRepository.findByRestaurantAndCategoryOrderBySortOrderAsc(restaurant, category);
            }
        } else {
            if (Boolean.TRUE.equals(availableOnly)) {
                items = menuItemRepository.findByRestaurantAndIsAvailableTrueOrderBySortOrderAsc(restaurant);
            } else {
                items = menuItemRepository.findByRestaurantOrderBySortOrderAsc(restaurant);
            }
        }

        // Apply "1000x Better" Smart Sorting: Recommended first, then Popularity (orderCount), then manual SortOrder
        items.sort((a, b) -> {
            // 1. Recommended (true first)
            boolean aRec = Boolean.TRUE.equals(a.getIsRecommended());
            boolean bRec = Boolean.TRUE.equals(b.getIsRecommended());
            if (aRec != bRec) return aRec ? -1 : 1;

            // 2. Order Count (descending)
            long aCnt = a.getOrderCount() != null ? a.getOrderCount() : 0L;
            long bCnt = b.getOrderCount() != null ? b.getOrderCount() : 0L;
            if (aCnt != bCnt) return Long.compare(bCnt, aCnt);

            // 3. Sort Order (ascending)
            int aSort = a.getSortOrder() != null ? a.getSortOrder() : 0;
            int bSort = b.getSortOrder() != null ? b.getSortOrder() : 0;
            if (aSort != bSort) return Integer.compare(aSort, bSort);

            // 4. Alphabetical
            String aName = a.getName() != null ? a.getName() : "";
            String bName = b.getName() != null ? b.getName() : "";
            return aName.compareToIgnoreCase(bName);
        });

        return items;
    }

    public MenuItem getById(@NonNull User restaurant, @NonNull Long id) {
        return menuItemRepository.findById(id)
                .filter(item -> item.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Menu item not found"));
    }

    @Transactional
    @NonNull
    public MenuItem create(@NonNull User restaurant, @NonNull Map<String, Object> data) {
        Object nameObj = data.get("name");
        String nameStr = (nameObj != null) ? nameObj.toString() : "Unnamed Item";

        Object priceObj = data.get("price");
        Double priceVal = (priceObj != null) ? Double.valueOf(priceObj.toString()) : 0.0;

        MenuItem item = MenuItem.builder()
                .restaurant(restaurant)
                .name(nameStr)
                .tamilName(data.containsKey("tamilName") && data.get("tamilName") != null ? data.get("tamilName").toString() : null)
                .description(data.getOrDefault("description", "").toString())
                .tamilDescription(data.containsKey("tamilDescription") && data.get("tamilDescription") != null ? data.get("tamilDescription").toString() : null)
                .category((String) data.get("category"))
                .price(priceVal)
                .taxRate(data.containsKey("taxRate") && data.get("taxRate") != null ? Double.valueOf(data.get("taxRate").toString()) : 0.0)
                .isVeg(Boolean.TRUE.equals(data.get("isVeg")))
                .isAvailable(!data.containsKey("isAvailable") || Boolean.TRUE.equals(data.get("isAvailable")))
                .preparationTime(data.containsKey("preparationTime") && data.get("preparationTime") != null ? Integer.valueOf(data.get("preparationTime").toString()) : 10)
                .sortOrder(data.containsKey("sortOrder") && data.get("sortOrder") != null ? Integer.valueOf(data.get("sortOrder").toString()) : 0)
                .build();

        MenuItem saved = menuItemRepository.save(Objects.requireNonNull(item));
        return saved;

    }

    @Transactional
    @NonNull
    public MenuItem update(@NonNull User restaurant, @NonNull Long id, @NonNull Map<String, Object> data) {
        MenuItem item = getById(restaurant, id);
        if (data.containsKey("name")) item.setName((String) data.get("name"));
        if (data.containsKey("tamilName")) item.setTamilName((String) data.get("tamilName"));
        if (data.containsKey("description")) item.setDescription((String) data.get("description"));
        if (data.containsKey("tamilDescription")) item.setTamilDescription((String) data.get("tamilDescription"));
        if (data.containsKey("category")) item.setCategory((String) data.get("category"));
        if (data.containsKey("price")) item.setPrice(Double.valueOf(data.get("price").toString()));
        if (data.containsKey("taxRate")) item.setTaxRate(Double.valueOf(data.get("taxRate").toString()));
        if (data.containsKey("isVeg")) item.setIsVeg((Boolean) data.get("isVeg"));
        if (data.containsKey("isAvailable")) item.setIsAvailable((Boolean) data.get("isAvailable"));
        if (data.containsKey("preparationTime") && data.get("preparationTime") != null) item.setPreparationTime(Integer.valueOf(data.get("preparationTime").toString()));
        if (data.containsKey("sortOrder") && data.get("sortOrder") != null) item.setSortOrder(Integer.valueOf(data.get("sortOrder").toString()));
        if (data.containsKey("imageUrl")) item.setImageUrl((String) data.get("imageUrl"));

        MenuItem saved = menuItemRepository.save(Objects.requireNonNull(item));
        return saved;

    }

    @Transactional
    public void delete(@NonNull User restaurant, @NonNull Long id) {
        MenuItem item = getById(restaurant, id);
        orderItemRepository.setMenuItemToNull(Objects.requireNonNull(item));
        menuItemRepository.delete(item);
    }

    @Transactional
    public MenuItem toggleAvailability(@NonNull User restaurant, @NonNull Long id) {
        MenuItem item = getById(restaurant, id);
        item.setIsAvailable(!Boolean.TRUE.equals(item.getIsAvailable()));
        return menuItemRepository.save(item);
    }

    public void deleteAll(@NonNull User restaurant) {
        orderItemRepository.setMenuItemNullByRestaurant(restaurant);
        menuItemRepository.deleteByRestaurant(restaurant);
    }

    public List<String> getCategories(@NonNull User restaurant) {
        return menuItemRepository.findDistinctCategoryByRestaurant(restaurant);
    }

    @Transactional
    public int importBulk(User restaurant, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null) throw new RuntimeException("Invalid file");

        try {
            if (filename.toLowerCase().endsWith(".csv")) {
                return parseCsv(restaurant, file);
            } else if (filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls")) {
                return parseExcel(restaurant, file);
            } else {
                throw new RuntimeException("Unsupported file type. Please upload Excel or CSV.");
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to process file: " + e.getMessage());
        }
    }

    private int parseCsv(User restaurant, MultipartFile file) throws Exception {
        System.out.println("🚀 Starting CSV Parse for restaurant: " + (restaurant != null ? restaurant.getId() : "NULL"));
        if (file == null || file.isEmpty()) {
            System.out.println("❌ MultipartFile is null or empty");
            throw new Exception("File is empty or missing");
        }
        
        int count = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            int lineNum = 0;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                System.out.println("📝 Processing Line " + lineNum + ": " + line);

                // Remove UTF-8 BOM if present on first line
                if (lineNum == 1 && line.startsWith("\uFEFF")) {
                    line = line.substring(1);
                    System.out.println("ℹ️ BOM detected and removed from line " + lineNum);
                }

                line = line.trim();
                if (line.isEmpty()) {
                    System.out.println("⏩ Skipping empty line " + lineNum);
                    continue;
                }
                
                String lower = line.toLowerCase();
                if (lower.startsWith("item") || lower.startsWith("name") || lower.startsWith("product")) continue;

                // Simple regex for CSV that handles quotes: split by comma NOT inside quotes
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                if (parts.length < 2) continue;

                try {
                    String name = cleanCsvValue(parts[0]);
                    Double price = Double.parseDouble(cleanCsvValue(parts[1]));
                    String category = parts.length > 2 ? cleanCsvValue(parts[2]) : "General";
                    
                    // Column 3 is Type (Veg/Non-Veg)
                    String type = parts.length > 3 ? cleanCsvValue(parts[3]) : "Veg";
                    boolean isVeg = !type.equalsIgnoreCase("Non-Veg");
                    
                    // Column 4 is Description
                    String description = parts.length > 4 ? cleanCsvValue(parts[4]) : "";

                    // Column 5 is Tamil Name
                    String tamilName = parts.length > 5 ? cleanCsvValue(parts[5]) : null;
                    
                    System.out.println("✅ Parsed item: " + name + " (Veg: " + isVeg + ")");

                    MenuItem item = MenuItem.builder()
                            .name(name)
                            .price(price)
                            .category(category)
                            .tamilName(tamilName)
                            .restaurant(restaurant)
                            .isAvailable(true)
                            .isVeg(isVeg)
                            .description(description)
                            .taxRate(0.0) // Default values
                            .preparationTime(10) // Default values
                            .sortOrder(0) // Default values
                            .build();
                    menuItemRepository.save(Objects.requireNonNull(item));
                    count++;
                } catch (Exception e) {
                    // Log error and continue to next line
                    System.err.println("Error parsing CSV line: " + line + " - " + e.getMessage());
                }
            }
        }
        return count;
    }

    private String cleanCsvValue(String value) {
        if (value == null) return "";
        value = value.trim();
        if (value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1);
        }
        return value.replace("\"\"", "\"").trim();
    }

    private int parseExcel(User restaurant, MultipartFile file) throws Exception {
        int count = 0;
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue; // Skip header

                Cell nameCell = row.getCell(0);
                Cell priceCell = row.getCell(1);
                Cell categoryCell = row.getCell(2);

                if (nameCell == null || priceCell == null) continue;

                try {
                    String name = nameCell.getStringCellValue().trim();
                    Double price = 0.0;
                    if (priceCell.getCellType() == CellType.NUMERIC) {
                        price = priceCell.getNumericCellValue();
                    } else if (priceCell.getCellType() == CellType.STRING) {
                        String priceStr = priceCell.getStringCellValue().replaceAll("[^\\d.]", "");
                        price = Double.valueOf(priceStr);
                    }
                    
                    String category = "General";
                    if (categoryCell != null) {
                        if (categoryCell.getCellType() == CellType.STRING) {
                            category = categoryCell.getStringCellValue().trim();
                        }
                    }

                    if (!name.isEmpty() && price > 0) {
                        saveImportedItem(restaurant, name, price, category);
                        count++;
                    }
                } catch (Exception e) { /* Skip */ }
            }
        }
        return count;
    }

    private void saveImportedItem(User restaurant, String name, Double price, String category) {
        MenuItem item = MenuItem.builder()
                .restaurant(restaurant)
                .name(name)
                .price(price)
                .category(category)
                .description("Imported via Bulk Upload")
                .isAvailable(true)
                .isVeg(true)
                .taxRate(0.0)
                .preparationTime(10)
                .sortOrder(0)
                .build();
        menuItemRepository.save(Objects.requireNonNull(item));

    }
}
