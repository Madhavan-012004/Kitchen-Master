package com.probloom.service;

import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.InventoryItem;
import com.probloom.model.entity.StockMovement;
import com.probloom.model.entity.User;
import com.probloom.repository.InventoryItemRepository;
import com.probloom.repository.StockMovementRepository;
import com.probloom.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.lang.NonNull;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryItemRepository inventoryItemRepository;
    private final StockMovementRepository stockMovementRepository;
    private final TransactionService transactionService;
    private final UserRepository userRepository;

    public List<InventoryItem> getAll(@NonNull User restaurant) {
        return inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
    }

    public List<InventoryItem> getLowStock(@NonNull User restaurant) {
        return inventoryItemRepository.findLowStockItems(restaurant);
    }

    public List<StockMovement> getMovements(@NonNull User restaurant) {
        return stockMovementRepository.findByRestaurantOrderByMovementTimestampDesc(restaurant);
    }

    public InventoryItem getById(@NonNull User restaurant, @NonNull Long id) {
        return inventoryItemRepository.findByRestaurantAndId(restaurant, id)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item not found (ID: " + id + ")"));
    }

    public InventoryItem getByBarcode(@NonNull User restaurant, @NonNull String barcode) {
        return inventoryItemRepository.findByRestaurantAndBarcode(restaurant, barcode)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item with barcode not found: " + barcode));
    }

    public InventoryItem getByName(@NonNull User restaurant, @NonNull String name) {
        return inventoryItemRepository.findByRestaurantAndNameIgnoreCaseAndIsActiveTrue(restaurant, name)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item not found with name: " + name));
    }

    @Transactional
    @NonNull
    public InventoryItem create(@NonNull User restaurant, @NonNull Map<String, Object> data) {
        Object nameObj = data.get("name");
        String nameStr = (nameObj != null) ? nameObj.toString() : "Unnamed Block";

        InventoryItem item = InventoryItem.builder()
                .restaurant(restaurant)
                .name(nameStr)
                .barcode((String) data.get("barcode"))
                .price(data.containsKey("price") && data.get("price") != null ? Double.valueOf(data.get("price").toString()) : 0.0)
                .isBilliable(!data.containsKey("isBilliable") || data.get("isBilliable") == null || Boolean.valueOf(data.get("isBilliable").toString()))
                .category(data.getOrDefault("category", "General").toString())
                .unit(InventoryItem.Unit.valueOf(data.getOrDefault("unit", "KG").toString().toUpperCase()))
                .currentStock(data.containsKey("currentStock") && data.get("currentStock") != null ? Double.valueOf(data.get("currentStock").toString()) : 0.0)
                .lowStockThreshold(data.containsKey("lowStockThreshold") && data.get("lowStockThreshold") != null ? Double.valueOf(data.get("lowStockThreshold").toString()) : 1.0)
                .costPerUnit(data.containsKey("costPerUnit") && data.get("costPerUnit") != null ? Double.valueOf(data.get("costPerUnit").toString()) : 0.0)
                .supplierName((String) data.get("supplierName"))
                .supplierPhone((String) data.get("supplierPhone"))
                .manufacturer((String) data.get("manufacturer"))
                .packSize((String) data.get("packSize"))
                .packMultiplier(data.containsKey("packMultiplier") ? Integer.valueOf(data.get("packMultiplier").toString()) : 1)
                .gstPercent(data.containsKey("gstPercent") && data.get("gstPercent") != null ? Double.valueOf(data.get("gstPercent").toString()) : 0.0)
                .batchNo((String) data.get("batchNo"))
                .expDate((String) data.get("expDate"))
                .hsnCode((String) data.get("hsnCode"))
                .build();

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));

        // Record Initial Expense if cost provided (only for paid quantity, not free packs)
        boolean recordExpense = data.containsKey("recordExpense") ? (boolean) data.get("recordExpense") : true;
        if (recordExpense && savedItem.getCostPerUnit() > 0 && savedItem.getCurrentStock() > 0) {
            // Paid packs only (exclude free packs from cost)
            double paidPieces = savedItem.getCurrentStock();
            if (data.containsKey("freePieces")) {
                paidPieces -= Double.valueOf(data.get("freePieces").toString());
            } else if (data.containsKey("freeStock")) {
                paidPieces -= Double.valueOf(data.get("freeStock").toString());
            }
            if (paidPieces > 0) {
                double baseCost = savedItem.getCostPerUnit() * paidPieces;
                double gstAmt = 0.0;
                if (savedItem.getGstPercent() != null && savedItem.getGstPercent() > 0) {
                    gstAmt = baseCost * savedItem.getGstPercent() / 100.0;
                }
                transactionService.create(restaurant, Objects.requireNonNull(Map.of(
                    "amount", baseCost + gstAmt,
                    "category", "Inventory Purchase",
                    "description", "Initial purchase of " + savedItem.getName(),
                    "paymentMethod", data.getOrDefault("paymentMethod", "Cash"),
                    "gstAmount", gstAmt
                )));
            }
        }

        // Log initial intake if stock > 0
        if (savedItem.getCurrentStock() > 0) {
            StockMovement movement = StockMovement.builder()
                    .restaurant(restaurant)
                    .inventoryItem(savedItem)
                    .type(StockMovement.MovementType.ADD)
                    .quantity(savedItem.getCurrentStock())
                    .reason("Initial stock intake")
                    .build();
            stockMovementRepository.save(Objects.requireNonNull(movement));
        }

        return savedItem;
    }

    @Transactional
    @NonNull
    public InventoryItem update(@NonNull User restaurant, @NonNull Long id, @NonNull Map<String, Object> data) {
        InventoryItem item = getById(restaurant, id);
        if (data.containsKey("name")) item.setName((String) data.get("name"));
        if (data.containsKey("barcode")) item.setBarcode((String) data.get("barcode"));
        if (data.containsKey("price")) item.setPrice(Double.valueOf(data.get("price").toString()));
        if (data.containsKey("isBilliable")) item.setIsBilliable(Boolean.valueOf(data.get("isBilliable").toString()));
        if (data.containsKey("category")) item.setCategory((String) data.get("category"));
        if (data.containsKey("unit")) item.setUnit(InventoryItem.Unit.valueOf(data.get("unit").toString().toUpperCase()));
        if (data.containsKey("lowStockThreshold")) item.setLowStockThreshold(Double.valueOf(data.get("lowStockThreshold").toString()));
        if (data.containsKey("costPerUnit")) item.setCostPerUnit(Double.valueOf(data.get("costPerUnit").toString()));

        if (data.containsKey("packSize")) item.setPackSize((String) data.get("packSize"));
        if (data.containsKey("packMultiplier") && data.get("packMultiplier") != null) item.setPackMultiplier(Integer.valueOf(data.get("packMultiplier").toString()));
        if (data.containsKey("batchNo")) item.setBatchNo((String) data.get("batchNo"));
        if (data.containsKey("expDate")) item.setExpDate((String) data.get("expDate"));
        if (data.containsKey("manufacturer")) item.setManufacturer((String) data.get("manufacturer"));
        if (data.containsKey("supplierName")) item.setSupplierName((String) data.get("supplierName"));
        if (data.containsKey("supplierPhone")) item.setSupplierPhone((String) data.get("supplierPhone"));
        if (data.containsKey("gstPercent") && data.get("gstPercent") != null) item.setGstPercent(Double.valueOf(data.get("gstPercent").toString()));
        if (data.containsKey("hsnCode")) item.setHsnCode((String) data.get("hsnCode"));

        InventoryItem saved = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return saved;
    }

    @Transactional
    @NonNull
    public InventoryItem adjustStock(@NonNull User restaurant, @NonNull Long id, @NonNull Map<String, Object> data, User performedBy) {
        String type = (String) data.get("type");
        Double quantity = Double.valueOf(data.get("quantity").toString());
        String reason = (String) data.getOrDefault("reason", "");
        InventoryItem item = getById(restaurant, id);
        StockMovement.MovementType movementType = StockMovement.MovementType.valueOf(type.toUpperCase());

        // Handle free quantity (free packs that don't generate expenditure)
        double freeQuantity = 0.0;
        if (data.containsKey("freeQuantity") && data.get("freeQuantity") != null) {
            freeQuantity = Double.valueOf(data.get("freeQuantity").toString());
        }

        switch (movementType) {
            case ADD:
                item.setCurrentStock(item.getCurrentStock() + quantity + freeQuantity);
                item.setLastRestockedAt(LocalDateTime.now());
                System.out.println("➕ Stock added: " + item.getName() + " (+" + quantity + " paid, +" + freeQuantity + " free) New stock: " + item.getCurrentStock());
                break;
            case DEDUCT:
                // Allow negative stock for sales/deductions to ensure tracking even if stock wasn't updated yet
                item.setCurrentStock(item.getCurrentStock() - quantity);
                System.out.println("➖ Stock deducted: " + item.getName() + " (-" + quantity + ") New stock: " + item.getCurrentStock());
                break;
            case ADJUST:
                item.setCurrentStock(quantity);
                System.out.println("🔄 Stock adjusted: " + item.getName() + " (set to " + quantity + ")");
                break;
        }

        // Record Expenditure if cost provided OR automatically calculate it for ADD movement
        if (movementType == StockMovement.MovementType.ADD) {
            Double totalCost = null;
            if (data.containsKey("totalCost") && data.get("totalCost") != null) {
                totalCost = Double.valueOf(data.get("totalCost").toString());
            } else if (item.getCostPerUnit() > 0 && quantity > 0) {
                // Automatically calculate based on buying price
                totalCost = item.getCostPerUnit() * quantity;
            }

            if (totalCost != null && totalCost > 0) {
                double gstAmount = 0.0;
                double discountAmount = 0.0;
                if (data.containsKey("gstAmount")) gstAmount = Double.valueOf(data.get("gstAmount").toString());
                if (data.containsKey("discountAmount")) discountAmount = Double.valueOf(data.get("discountAmount").toString());

                String invoiceNumber = data.containsKey("invoiceNumber") ? (String) data.get("invoiceNumber") : null;

                if (invoiceNumber != null && !invoiceNumber.isBlank()) {
                    // Use invoice-grouped upsert with total amount including GST
                    transactionService.createOrUpdateByInvoice(
                        restaurant, invoiceNumber,
                        totalCost + gstAmount - discountAmount, gstAmount, discountAmount,
                        1,
                        "Restock: " + item.getName() + " (" + quantity + " " + item.getUnit() + ")",
                        (String) data.getOrDefault("paymentMethod", "Cash")
                    );
                } else {
                    transactionService.create(restaurant, new java.util.HashMap<>(Map.of(
                        "amount", totalCost + gstAmount - discountAmount,
                        "category", "Inventory Purchase",
                        "description", "Restock: " + item.getName() + " (" + quantity + " " + item.getUnit() + ")",
                        "paymentMethod", data.getOrDefault("paymentMethod", "Cash"),
                        "gstAmount", gstAmount,
                        "discountAmount", discountAmount
                    )));
                }
            }
        }

        StockMovement movement = StockMovement.builder()
                .restaurant(restaurant)
                .inventoryItem(item)
                .type(movementType)
                .quantity(quantity + freeQuantity)
                .paidQuantity(quantity)
                .freeQuantity(freeQuantity)
                .reason(reason + (freeQuantity > 0 ? " (incl. " + freeQuantity + " free)" : ""))
                .performedBy(performedBy)
                .build();

        stockMovementRepository.save(Objects.requireNonNull(movement));

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return savedItem;
    }


    @Transactional
    public void delete(@NonNull User restaurant, @NonNull Long id) {
        InventoryItem item = getById(restaurant, id);
        item.setIsActive(false);
        inventoryItemRepository.save(item);
    }

    @Transactional
    @NonNull
    public InventoryItem incrementStockByBarcode(@NonNull User restaurant, @NonNull String barcode, double amount, User performedBy) {
        InventoryItem item = getByBarcode(restaurant, barcode);
        item.setCurrentStock(item.getCurrentStock() + amount);
        item.setLastRestockedAt(LocalDateTime.now());

        StockMovement movement = StockMovement.builder()
                .restaurant(restaurant)
                .inventoryItem(item)
                .type(StockMovement.MovementType.ADD)
                .quantity(amount)
                .reason("Rapid Scanner Intake")
                .performedBy(performedBy)
                .build();

        stockMovementRepository.save(Objects.requireNonNull(movement));

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return savedItem;
    }

    @Transactional
    public List<InventoryItem> bulkUpdate(User restaurant, List<Map<String, Object>> itemsData, User performedBy) {
        for (Map<String, Object> data : itemsData) {
            Long id = Long.valueOf(data.get("id").toString());
            InventoryItem item = getById(Objects.requireNonNull(restaurant), Objects.requireNonNull(id));

            if (data.containsKey("currentStock")) {
                double newStock = Double.valueOf(data.get("currentStock").toString());
                double diff = newStock - item.getCurrentStock();

                if (diff != 0) {
                    item.setCurrentStock(newStock);
                    StockMovement movement = StockMovement.builder()
                            .restaurant(restaurant)
                            .inventoryItem(item)
                            .type(diff > 0 ? StockMovement.MovementType.ADD : StockMovement.MovementType.DEDUCT)
                            .quantity(Math.abs(diff))
                            .reason("Bulk Inventory Update")
                            .performedBy(performedBy)
                            .build();
                    stockMovementRepository.save(Objects.requireNonNull(movement));
                }
            }

            if (data.containsKey("name")) item.setName((String) data.get("name"));
            if (data.containsKey("price")) item.setPrice(Double.valueOf(data.get("price").toString()));
            if (data.containsKey("costPerUnit")) item.setCostPerUnit(Double.valueOf(data.get("costPerUnit").toString()));

            inventoryItemRepository.save(Objects.requireNonNull(item));
        }
        return getAll(Objects.requireNonNull(restaurant));
    }

    public List<Map<String, Object>> parseInvoiceCsv(byte[] fileData) throws Exception {
        List<Map<String, Object>> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new java.io.ByteArrayInputStream(fileData), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            String[] headers = null;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                String[] cols = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
                for (int i = 0; i < cols.length; i++) cols[i] = cols[i].replace("\"", "").trim();

                if (headers == null) {
                    headers = cols;
                    continue;
                }
                
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < headers.length && i < cols.length; i++) {
                    row.put(headers[i], cols[i]);
                }
                result.add(row);
            }
        }
        return result;
    }

    /**
     * Imports inventory from CSV.
     * FREE packs are added to total stock but NOT counted in expenditure.
     * Rows sharing the same invoice number are grouped into ONE expenditure transaction.
     */
    @Transactional
    public int importCsv(User restaurant, MultipartFile file) throws Exception {
        int count = 0;

        // Invoice-grouped expenditure accumulator: invoiceNo -> {baseAmount, gstAmount, discountAmount, itemCount, description, paymentMethod}
        Map<String, double[]> invoiceAccumulator = new LinkedHashMap<>(); // [baseAmt, gstAmt, discountAmt, itemCount, totalAmt]
        Map<String, String> invoicePaymentMethod = new LinkedHashMap<>();
        Map<String, String> invoiceSupplier = new LinkedHashMap<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            String[] headers = null;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                if (headers == null) {
                    headers = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                    continue;
                }
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                Map<String, Object> data = new java.util.HashMap<>();

                double qty = 0;
                double free = 0;
                double gstPct = 0;
                double discountAmt = 0;
                String invoiceNo = "";

                for (int i = 0; i < headers.length && i < parts.length; i++) {
                    String header = headers[i].trim().toUpperCase();
                    String val = parts[i].trim();
                    if (val.startsWith("\"") && val.endsWith("\"")) {
                        val = val.substring(1, val.length() - 1);
                    }

                    if (header.equals("MFR") || header.equals("MANUFACTURER")) {
                        data.put("manufacturer", val);
                    } else if (header.equals("ITEM DESCRIPTION") || header.equals("NAME") || header.equals("DESCRIPTION")) {
                        data.put("name", val);
                    } else if (header.equals("PACK") || header.equals("PACK SIZE")) {
                        data.put("packSize", val);
                    } else if (header.equals("HSN/SAC") || header.equals("HSN")) {
                        data.put("hsnCode", val);
                    } else if (header.equals("BATCH") || header.equals("BATCH NO")) {
                        data.put("batchNo", val);
                    } else if (header.equals("EXP") || header.equals("EXPIRY") || header.equals("EXP DATE")) {
                        data.put("expDate", val);
                    } else if (header.equals("QTY") || header.equals("QUANTITY")) {
                        qty = safeParseDouble(val);
                    } else if (header.equals("FREE")) {
                        free = safeParseDouble(val);
                    } else if (header.equals("RATE") || header.equals("COST")) {
                        data.put("costPerUnit", safeParseDouble(val));
                    } else if (header.equals("MRP") || header.equals("PRICE")) {
                        data.put("price", safeParseDouble(val));
                    } else if (header.equals("GST%") || header.equals("GSTN") || header.equals("GST")) {
                        gstPct = safeParseDouble(val);
                        data.put("gstPercent", gstPct);
                    } else if (header.equals("GST AMOUNT") || header.equals("GST AMT")) {
                        data.put("gstAmountFile", safeParseDouble(val));
                    } else if (header.equals("DISCOUNT") || header.equals("DISC") || header.equals("DISC AMT") || header.equals("DISCOUT")) {
                        discountAmt = safeParseDouble(val);
                    } else if (header.equals("DISC%")) {
                        data.put("discPctFile", safeParseDouble(val));
                    } else if (header.equals("AMOUNT") || header.equals("BASE AMOUNT")) {
                        data.put("amountFile", safeParseDouble(val));
                    } else if (header.equals("TOTAL AMOUNT") || header.equals("NET AMOUNT") || header.equals("TOTAL")) {
                        data.put("totalAmountFile", safeParseDouble(val));
                    } else if (header.equals("SUPPLY") || header.equals("SUPPLIER")) {
                        data.put("supplierName", val);
                    } else if (header.equals("INVOICE NUMBER") || header.equals("INV NO") || header.equals("INVOICE NO")) {
                        invoiceNo = val;
                    } else {
                        data.put(headers[i].trim(), val);
                    }
                }

                // Validate Name - skip junk rows
                String itemName = (String) data.get("name");
                if (itemName == null || itemName.trim().isEmpty() || itemName.equalsIgnoreCase("0")) {
                    continue;
                }

                // Pharma Logic: Calculate multiplier from Pack column
                int multiplier = parsePackMultiplier((String) data.get("packSize"));
                data.put("packMultiplier", multiplier);

                // ── KEY FIX: paid packs vs free packs ──
                // Total stock = (paid qty + free qty) × multiplier
                // Cost only applies to paid qty
                double paidPieces = qty * multiplier;
                double freePieces = free * multiplier;
                double totalPieces = paidPieces + freePieces;

                data.put("currentStock", totalPieces);
                data.put("freePieces", freePieces); // tracked for expense exclusion

                // Cost and Price per piece (based on PACK rate)
                double ratePerPack = 0;
                if (data.containsKey("costPerUnit")) {
                    ratePerPack = (double) data.get("costPerUnit");
                    data.put("costPerUnit", multiplier > 0 ? ratePerPack / multiplier : ratePerPack);
                }
                if (data.containsKey("price")) {
                    double mrpPerPack = (double) data.get("price");
                    data.put("price", multiplier > 0 ? mrpPerPack / multiplier : mrpPerPack);
                }

                // ── EXPENDITURE for this line item (paid packs only) ──
                double lineBase = data.containsKey("amountFile") ? (double) data.get("amountFile") : (ratePerPack * qty);
                double lineGst = data.containsKey("gstAmountFile") ? (double) data.get("gstAmountFile") : (lineBase * gstPct / 100.0);

                double lineTotalAmount = data.containsKey("totalAmountFile") ? (double) data.get("totalAmountFile") : (lineBase + lineGst - discountAmt);

                // Note Invoice Number in reason
                String reason = "CSV Import";
                if (invoiceNo != null && !invoiceNo.isEmpty()) {
                    reason += " (Inv #" + invoiceNo + ")";
                }
                data.put("importReason", reason);

                // Accumulate into invoice bucket
                if (invoiceNo != null && !invoiceNo.isEmpty() && lineTotalAmount > 0) {
                    double[] acc = invoiceAccumulator.getOrDefault(invoiceNo, new double[]{0, 0, 0, 0, 0});
                    acc[0] += lineBase;         // base amount
                    acc[1] += lineGst;          // gst amount
                    acc[2] += discountAmt;      // discount
                    acc[3] += 1;                // item count
                    acc[4] += lineTotalAmount;  // exact total amount from CSV
                    invoiceAccumulator.put(invoiceNo, acc);
                    invoicePaymentMethod.putIfAbsent(invoiceNo, "Cash");
                    if (data.containsKey("supplierName")) {
                        invoiceSupplier.putIfAbsent(invoiceNo, (String) data.get("supplierName"));
                    }
                }

                // Check for duplicates (Name + Batch)
                String batch = (String) data.get("batchNo");
                java.util.Optional<InventoryItem> existing = (batch != null && !batch.isEmpty())
                    ? inventoryItemRepository.findByRestaurantAndNameIgnoreCaseAndBatchNoAndIsActiveTrue(restaurant, itemName, batch)
                    : inventoryItemRepository.findByRestaurantAndNameIgnoreCaseAndIsActiveTrue(restaurant, itemName);

                if (existing.isPresent()) {
                    // Update existing — add total pieces (paid + free)
                    InventoryItem item = existing.get();
                    item.setCurrentStock(item.getCurrentStock() + totalPieces);
                    item.setLastRestockedAt(LocalDateTime.now());

                    if (data.containsKey("costPerUnit")) item.setCostPerUnit((double) data.get("costPerUnit"));
                    if (data.containsKey("price")) item.setPrice((double) data.get("price"));
                    if (data.containsKey("supplierName")) item.setSupplierName((String) data.get("supplierName"));
                    if (data.containsKey("batchNo")) item.setBatchNo((String) data.get("batchNo"));
                    if (data.containsKey("expDate")) item.setExpDate((String) data.get("expDate"));
                    if (data.containsKey("hsnCode")) item.setHsnCode((String) data.get("hsnCode"));
                    if (data.containsKey("manufacturer")) item.setManufacturer((String) data.get("manufacturer"));

                    inventoryItemRepository.save(item);

                    // Log movement
                    StockMovement movement = StockMovement.builder()
                            .restaurant(restaurant)
                            .inventoryItem(item)
                            .type(StockMovement.MovementType.ADD)
                            .quantity(totalPieces)
                            .reason(reason + (freePieces > 0 ? " (+" + (int) freePieces + " free)" : ""))
                            .build();
                    stockMovementRepository.save(java.util.Objects.requireNonNull(movement));

                } else {
                    // Create new item — expense will be recorded via invoice accumulator
                    // Do NOT pass recordExpense=true here to avoid double-counting
                    data.put("recordExpense", false);
                    createWithReason(restaurant, data, reason);
                }
                count++;
            }
        }

        // ── After all rows processed: create one transaction per invoice ──
        for (Map.Entry<String, double[]> entry : invoiceAccumulator.entrySet()) {
            String invNo = entry.getKey();
            double[] acc = entry.getValue();
            double gstAmt = acc[1];
            double discountTotal = acc[2];
            int itemCount = (int) acc[3];
            double totalAmt = acc[4];
            String payMethod = invoicePaymentMethod.getOrDefault(invNo, "Cash");
            String supplier = invoiceSupplier.getOrDefault(invNo, "");
            String finalDesc = "CSV Import - " + itemCount + " item(s)";
            if (!supplier.isEmpty()) finalDesc = supplier + " - " + finalDesc;

            if (totalAmt > 0) {
                transactionService.createOrUpdateByInvoice(
                    java.util.Objects.requireNonNull(restaurant),
                    java.util.Objects.requireNonNull(invNo),
                    totalAmt, gstAmt, discountTotal,
                    itemCount,
                    finalDesc,
                    payMethod
                );
            }
        }

        return count;
    }

    private double safeParseDouble(String val) {
        if (val == null || val.trim().isEmpty()) return 0.0;
        try {
            return Double.parseDouble(val.replaceAll("[^\\d.]", ""));
        } catch (Exception e) {
            return 0.0;
        }
    }

    @Transactional
    public InventoryItem createWithReason(User restaurant, Map<String, Object> data, String reason) {
        InventoryItem item = create(java.util.Objects.requireNonNull(restaurant), java.util.Objects.requireNonNull(data));
        // Find the last movement and update reason (since create() makes one)
        List<StockMovement> movements = stockMovementRepository.findByRestaurantOrderByMovementTimestampDesc(restaurant);
        if (!movements.isEmpty()) {
            StockMovement m = movements.get(0);
            if (m.getInventoryItem().getId().equals(item.getId())) {
                m.setReason(reason);
                stockMovementRepository.save(m);
            }
        }
        return item;
    }

    private int parsePackMultiplier(String packSize) {
        if (packSize == null || packSize.isEmpty()) return 1;
        try {
            String sanitized = packSize.toLowerCase().replaceAll("[^0-9*x]", "");
            if (sanitized.contains("*") || sanitized.contains("x")) {
                String[] parts = sanitized.split("[*x]");
                int total = 1;
                for (String p : parts) {
                    if (!p.isEmpty()) total *= Integer.parseInt(p);
                }
                return total > 0 ? total : 1;
            } else {
                int val = Integer.parseInt(sanitized.replaceAll("[^0-9]", ""));
                return val > 0 ? val : 1;
            }
        } catch (Exception e) {
            return 1;
        }
    }

    @Transactional
    public void renameCategory(@NonNull User restaurant, String oldName, String newName) {
        if (oldName == null || newName == null || oldName.trim().isEmpty() || newName.trim().isEmpty()) {
            return;
        }
        
        // 1. Rename category of all items belonging to oldName
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        for (InventoryItem item : items) {
            if (oldName.equalsIgnoreCase(item.getCategory())) {
                item.setCategory(newName.trim());
                inventoryItemRepository.save(item);
            }
        }

        // 2. Update stockCategories of the user
        User owner = (restaurant.getRole() == User.Role.OWNER) ? restaurant : restaurant.getParentOwner();
        if (owner != null) {
            String currentCats = owner.getStockCategories();
            if (currentCats != null) {
                List<String> list = new ArrayList<>(Arrays.asList(currentCats.split(",")));
                for (int i = 0; i < list.size(); i++) {
                    if (list.get(i).trim().equalsIgnoreCase(oldName.trim())) {
                        list.set(i, newName.trim());
                    }
                }
                owner.setStockCategories(String.join(",", list));
                userRepository.save(owner);
            }
        }
    }

    @Transactional
    public void deleteCategory(@NonNull User restaurant, String catName) {
        if (catName == null || catName.trim().isEmpty()) return;
        
        // 1. Move items belonging to catName back to "General"
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        for (InventoryItem item : items) {
            if (catName.equalsIgnoreCase(item.getCategory())) {
                item.setCategory("General");
                inventoryItemRepository.save(item);
            }
        }

        // 2. Remove from user's stockCategories
        User owner = (restaurant.getRole() == User.Role.OWNER) ? restaurant : restaurant.getParentOwner();
        if (owner != null) {
            String currentCats = owner.getStockCategories();
            if (currentCats != null) {
                List<String> list = new ArrayList<>(Arrays.asList(currentCats.split(",")));
                list.removeIf(c -> c.trim().equalsIgnoreCase(catName.trim()));
                owner.setStockCategories(String.join(",", list));
                userRepository.save(owner);
            }
        }
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public void bulkAdd(@NonNull User restaurant, @NonNull Map<String, Object> body) {
        String invoiceNo = (String) body.getOrDefault("invoiceNo", "");
        String supplierName = (String) body.getOrDefault("supplierName", "");
        String paymentMethod = (String) body.getOrDefault("paymentMethod", "Cash");
        List<Map<String, Object>> itemsList = (List<Map<String, Object>>) body.get("items");
        if (itemsList == null || itemsList.isEmpty()) return;

        double totalGst = 0;
        double totalDiscount = 0;
        double totalAmount = 0;
        int itemCount = 0;

        for (Map<String, Object> itemData : itemsList) {
            String itemName = (String) itemData.get("name");
            if (itemName == null || itemName.trim().isEmpty()) continue;

            String batch = itemData.get("batchNo") != null ? itemData.get("batchNo").toString() : "";
            double qty = safeParseDouble(itemData.getOrDefault("qty", "0").toString());
            double free = safeParseDouble(itemData.getOrDefault("free", "0").toString());
            double costPerUnit = safeParseDouble(itemData.getOrDefault("costPerUnit", "0").toString());
            double price = safeParseDouble(itemData.getOrDefault("price", "0").toString());
            double gstPct = safeParseDouble(itemData.getOrDefault("gstPercent", "0").toString());
            double discountAmt = safeParseDouble(itemData.getOrDefault("discount", "0").toString());
            String expDate = (String) itemData.getOrDefault("expDate", "");
            String hsnCode = (String) itemData.getOrDefault("hsnCode", "");
            String category = (String) itemData.getOrDefault("category", "General");
            String unit = (String) itemData.getOrDefault("unit", "PIECE");

            // Multiplier logic from packSize
            String packSize = (String) itemData.getOrDefault("packSize", "1x1");
            int multiplier = parsePackMultiplier(packSize);

            double paidPieces = qty * multiplier;
            double freePieces = free * multiplier;
            double totalPieces = paidPieces + freePieces;

            double ratePerPiece = multiplier > 0 ? costPerUnit / multiplier : costPerUnit;
            double pricePerPiece = multiplier > 0 ? price / multiplier : price;

            double lineBase = costPerUnit * qty;
            double lineGst = lineBase * gstPct / 100.0;
            double lineTotal = lineBase + lineGst - discountAmt;

            totalGst += lineGst;
            totalDiscount += discountAmt;
            totalAmount += lineTotal;
            itemCount++;

            String reason = "Invoice Import";
            if (!invoiceNo.isEmpty()) {
                reason += " (Inv #" + invoiceNo + ")";
            }

            java.util.Optional<InventoryItem> existing = (!batch.isEmpty())
                ? inventoryItemRepository.findByRestaurantAndNameIgnoreCaseAndBatchNoAndIsActiveTrue(restaurant, itemName, batch)
                : inventoryItemRepository.findByRestaurantAndNameIgnoreCaseAndIsActiveTrue(restaurant, itemName);

            if (existing.isPresent()) {
                InventoryItem item = existing.get();
                item.setCurrentStock(item.getCurrentStock() + totalPieces);
                item.setLastRestockedAt(LocalDateTime.now());
                item.setCostPerUnit(ratePerPiece);
                item.setPrice(pricePerPiece);
                if (!supplierName.isEmpty()) item.setSupplierName(supplierName);
                if (!batch.isEmpty()) item.setBatchNo(batch);
                if (!expDate.isEmpty()) item.setExpDate(expDate);
                if (!hsnCode.isEmpty()) item.setHsnCode(hsnCode);
                inventoryItemRepository.save(item);

                StockMovement movement = StockMovement.builder()
                        .restaurant(restaurant)
                        .inventoryItem(item)
                        .type(StockMovement.MovementType.ADD)
                        .quantity(totalPieces)
                        .reason(reason + (freePieces > 0 ? " (+" + (int) freePieces + " free)" : ""))
                        .build();
                stockMovementRepository.save(java.util.Objects.requireNonNull(movement));
            } else {
                Map<String, Object> createData = new java.util.HashMap<>();
                createData.put("name", itemName);
                createData.put("category", category);
                createData.put("batchNo", batch);
                createData.put("expDate", expDate);
                createData.put("hsnCode", hsnCode);
                createData.put("currentStock", totalPieces);
                createData.put("costPerUnit", ratePerPiece);
                createData.put("price", pricePerPiece);
                createData.put("unit", unit.toUpperCase());
                createData.put("isBilliable", true);
                if (!supplierName.isEmpty()) createData.put("supplierName", supplierName);
                createData.put("recordExpense", false); // recorded in bulk invoice transaction below

                createWithReason(restaurant, createData, reason);
            }
        }

        if (totalAmount > 0 && !invoiceNo.isEmpty()) {
            String finalDesc = "Invoice Import - " + itemCount + " item(s)";
            if (!supplierName.isEmpty()) finalDesc = supplierName + " - " + finalDesc;

            transactionService.createOrUpdateByInvoice(
                restaurant,
                invoiceNo,
                totalAmount, totalGst, totalDiscount,
                itemCount,
                finalDesc,
                paymentMethod
            );
        }
    }
}
