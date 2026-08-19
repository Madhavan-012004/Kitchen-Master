package com.probloom.service;

import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.Orders;
import com.probloom.model.entity.OrderItem;
import com.probloom.model.entity.ExtraCharge;
import com.probloom.model.entity.User;
import com.probloom.model.entity.MenuItem;
import com.probloom.model.entity.InventoryItem;
import com.probloom.repository.OrdersRepository;
import com.probloom.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Objects;
import java.util.stream.Collectors;

import com.probloom.model.entity.Customer;
import com.probloom.repository.CustomerRepository;
import com.probloom.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrdersRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final SocketService socketService;
    private final PrintService printService;
    private final InventoryService inventoryService;
    private final CustomerService customerService;
    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final WhatsAppDeliveryService whatsAppDeliveryService;

    public List<Orders> getActiveOrders(@NonNull User restaurant) {
        return orderRepository.findByRestaurantAndStatusNotInOrderByCreatedAtDesc(
                restaurant, Arrays.asList(Orders.OrderStatus.PAID, Orders.OrderStatus.CANCELLED));
    }

    public List<Orders> getActiveOrdersByTable(@NonNull User restaurant, String tableNumber) {
        String normalizedTable = normalizeTableNumber(tableNumber);
        return orderRepository.findByRestaurantAndTableNumberAndStatusNotInOrderByCreatedAtDesc(
                restaurant, normalizedTable, Arrays.asList(Orders.OrderStatus.PAID, Orders.OrderStatus.CANCELLED));
    }

    private String normalizeTableNumber(String tableNumber) {
        if (tableNumber == null || "Takeaway".equalsIgnoreCase(tableNumber.trim()) || tableNumber.trim().isEmpty()) {
            return "Takeaway";
        }
        String table = tableNumber.trim();
        if (!table.toLowerCase().startsWith("table ")) {
            return "Table " + table;
        }
        // Capitalize "Table" if it starts with "table "
        if (table.toLowerCase().startsWith("table ")) {
            return "Table " + table.substring(6).trim();
        }
        return table;
    }

    private void handleCustomerLoyaltyPoints(Orders order, User restaurant) {
        if (order.getCustomerPhone() == null || order.getCustomerPhone().trim().isEmpty()) {
            return;
        }
        // Points already handled if not null? We should check if points were awarded
        // for this order.
        // Assuming we only call this once per PAID status.
        Customer customer = customerService.createOrUpdateCustomer(
                Objects.requireNonNull(restaurant.getId()),
                Objects.requireNonNull(order.getCustomerPhone()),
                order.getCustomerName(),
                null);

        Double currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0.0;

        // Deduct redeemed points
        Double redeemed = order.getPointsRedeemed() != null ? order.getPointsRedeemed() : 0.0;

        // Award new points based on total after discount and redeemed
        Double newPoints = (order.getTotal() != null ? order.getTotal() : 0.0) / 100.0;

        customer.setLoyaltyPoints(currentPoints - redeemed + newPoints);
        customerRepository.save(customer);
    }

    public List<Orders> getAllOrders(@NonNull User restaurant) {
        return orderRepository.findByRestaurantOrderByCreatedAtDesc(restaurant);
    }

    public List<Orders> getFilteredHistory(@NonNull User restaurant, String date, String status, String orderType,
            String search, int limit) {
        List<Orders> all;

        // Fetch by date range or get all
        if (date != null && !date.isEmpty()) {
            try {
                java.time.ZoneId ist = java.time.ZoneId.of("Asia/Kolkata");
                java.time.LocalDate localDate = java.time.LocalDate.parse(date);
                LocalDateTime naiveFrom = localDate.atStartOfDay();
                LocalDateTime naiveTo = localDate.atTime(23, 59, 59);
                // Try IST-aware range first
                LocalDateTime from = localDate.atStartOfDay(ist).withZoneSameInstant(java.time.ZoneOffset.UTC)
                        .toLocalDateTime();
                LocalDateTime to = localDate.atTime(23, 59, 59).atZone(ist)
                        .withZoneSameInstant(java.time.ZoneOffset.UTC).toLocalDateTime();
                all = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, from, to);
                // Fallback to naive range if IST range returned nothing
                if (all.isEmpty()) {
                    all = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, naiveFrom,
                            naiveTo);
                }
            } catch (Exception e) {
                all = orderRepository.findByRestaurantOrderByCreatedAtDesc(restaurant);
            }
        } else {
            all = orderRepository.findByRestaurantOrderByCreatedAtDesc(restaurant);
        }

        // Filter by status (safe string comparison on enum name)
        if (status != null && !status.isEmpty() && !status.equalsIgnoreCase("All")) {
            String upperStatus = status.toUpperCase();
            all = all.stream()
                    .filter(o -> o.getStatus() != null && o.getStatus().name().equalsIgnoreCase(upperStatus))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Filter by orderType (safe string comparison — DB stores DINE_IN / TAKEAWAY)
        if (orderType != null && !orderType.isEmpty() && !orderType.equalsIgnoreCase("All")) {
            // Normalize: "dine-in" → "DINE_IN", "takeaway" → "TAKEAWAY"
            String normalized = orderType.toUpperCase().replace("-", "_");
            all = all.stream()
                    .filter(o -> o.getOrderType() != null && o.getOrderType().name().equalsIgnoreCase(normalized))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Apply Search (Filter by Customer Name, Customer Phone, or Order Number)
        if (search != null && !search.trim().isEmpty()) {
            String query = search.trim().toLowerCase();
            all = all.stream()
                    .filter(o -> (o.getCustomerPhone() != null && o.getCustomerPhone().toLowerCase().contains(query)) ||
                            (o.getCustomerName() != null && o.getCustomerName().toLowerCase().contains(query)) ||
                            (o.getOrderNumber() != null && o.getOrderNumber().toLowerCase().contains(query)))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Apply limit
        if (all.size() > limit)
            all = all.subList(0, limit);

        return all;
    }

    public Orders getById(@NonNull User restaurant, Long id) {
        return orderRepository.findByRestaurantAndId(restaurant, id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    @Transactional
    public Orders create(@NonNull User restaurant, User createdBy, @NonNull Map<String, Object> data) {
        // Check for offline duplicate
        String offlineId = (String) data.get("offlineId");
        if (offlineId != null) {
            Optional<Orders> existing = orderRepository.findByOfflineId(offlineId);
            if (existing.isPresent())
                return existing.get();
        }

        String tableNumber = normalizeTableNumber(
                data.get("tableNumber") != null ? data.get("tableNumber").toString() : "Takeaway");
        boolean isDineIn = !"Takeaway".equalsIgnoreCase(tableNumber);
        boolean activeOrderFound = false;

        Orders order = null;
        if (isDineIn) { // Only check for active orders if it's a dine-in order
            List<Orders> activeOrders = orderRepository
                    .findByRestaurantAndTableNumberAndStatusNotInOrderByCreatedAtDesc(
                            restaurant, tableNumber,
                            Arrays.asList(Orders.OrderStatus.PAID, Orders.OrderStatus.CANCELLED));
            if (!activeOrders.isEmpty()) {
                // If there's an active order for the same table that isn't paid, merge into it
                order = activeOrders.get(0);
                // If the existing order was cancelled, we shouldn't merge into it, but the
                // query excludes PAID.
                // Let's also exclude CANCELLED just in case.
                if (order.getStatus() == Orders.OrderStatus.CANCELLED) {
                    order = null;
                } else {
                    activeOrderFound = true;
                }
            }
        }

        if (order == null) {
            String providedOrderNumber = (data.containsKey("billNo") && data.get("billNo") != null
                    && !data.get("billNo").toString().trim().isEmpty())
                            ? data.get("billNo").toString().trim()
                            : (data.containsKey("orderNumber") && data.get("orderNumber") != null
                                    && !data.get("orderNumber").toString().trim().isEmpty()
                                            ? data.get("orderNumber").toString().trim()
                                            : (data.containsKey("billNumber") && data.get("billNumber") != null
                                                    && !data.get("billNumber").toString().trim().isEmpty()
                                                            ? data.get("billNumber").toString().trim()
                                                            : null));

            // Regenerate if it is null or already taken (fixes duplicate key issues for
            // multiple tabs)
            String orderNumber = providedOrderNumber;
            if (orderNumber != null
                    && orderRepository.existsByRestaurantIdAndOrderNumber(restaurant.getId(), orderNumber)) {
                orderNumber = null;
            }
            if (orderNumber == null) {
                orderNumber = generateOrderNumber(restaurant);
            }
            String tokenNumber = generateTokenNumber(restaurant);
            order = Orders.builder()
                    .restaurant(restaurant)
                    .createdBy(createdBy)
                    .waiterName(createdBy != null ? createdBy.getName() : "Table QR")
                    .orderNumber(orderNumber)
                    .tokenNumber(tokenNumber)
                    .tableNumber(tableNumber)
                    .discountType(data.containsKey("discountType")
                            ? Orders.DiscountType.valueOf(data.get("discountType").toString().toUpperCase())
                            : Orders.DiscountType.NONE)
                    .discountValue(parseOptionalDouble(data, "discountValue", 0.0))
                    .discountAmount(parseOptionalDouble(data, "discountAmount", 0.0))
                    .pointsRedeemed(parseOptionalDouble(data, "pointsRedeemed", 0.0))
                    .orderType(parseOrderType(data.get("orderType")))
                    .customerName(data.get("customerName") != null ? data.get("customerName").toString() : null)
                    .customerPhone(data.get("customerPhone") != null ? data.get("customerPhone").toString() : null)
                    .notes(data.get("notes") != null ? data.get("notes").toString() : null)
                    .isOffline(Boolean.TRUE.equals(data.get("isOffline")))
                    .offlineId(offlineId)
                    .syncedAt(offlineId != null ? LocalDateTime.now() : null)
                    .billTemplate(data.getOrDefault("billTemplate", "standard").toString())
                    .doctorName(data.get("doctorName") != null ? data.get("doctorName").toString() : null)
                    .numberOfDays(data.get("numberOfDays") != null ? data.get("numberOfDays").toString() : null)
                    .customerFirm(data.get("customerFirm") != null ? data.get("customerFirm").toString() : null)
                    .printWithGst(
                            data.get("printWithGst") != null ? Boolean.valueOf(data.get("printWithGst").toString())
                                    : true)
                    .build();
            // Apply frontend status if specified (especially for POS override)
            if (data.containsKey("status") && data.get("status") != null) {
                try {
                    order.setStatus(Orders.OrderStatus.valueOf(data.get("status").toString().toUpperCase()));
                } catch (Exception e) {
                    order.setStatus(Orders.OrderStatus.PENDING);
                }
            } else {
                order.setStatus(Orders.OrderStatus.PENDING);
            }
            if (data.containsKey("paymentStatus") && data.get("paymentStatus") != null) {
                try {
                    order.setPaymentStatus(
                            Orders.PaymentStatus.valueOf(data.get("paymentStatus").toString().toUpperCase()));
                } catch (Exception e) {
                }
            }
        } else {
            // Update the existing order for new items
            if (data.containsKey("notes")) {
                String newNotes = data.get("notes") != null ? data.get("notes").toString() : null;
                if (newNotes != null && !newNotes.isEmpty()) {
                    order.setNotes(
                            order.getNotes() != null ? order.getNotes() + " | Supplement: " + newNotes : newNotes);
                }
            }
            // If the order was READY or SERVED, moving back to PREPARING because new items
            // came
            if (order.getStatus() == Orders.OrderStatus.READY || order.getStatus() == Orders.OrderStatus.SERVED) {
                order.setStatus(Orders.OrderStatus.PREPARING);
            }
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsData = (List<Map<String, Object>>) data.get("items");
        if (itemsData != null) {
            for (Map<String, Object> itemData : itemsData) {
                MenuItem menuItem = null;
                if (itemData.get("menuItemId") != null) {
                    try {
                        Long mId = Long.valueOf(itemData.get("menuItemId").toString());
                        menuItem = menuItemRepository.findById(Objects.requireNonNull(mId)).orElse(null);
                    } catch (Exception ignored) {
                    }
                }
                OrderItem oi = OrderItem.builder()
                        .order(order)
                        .menuItem(menuItem)
                        .name(itemData.get("name") != null ? itemData.get("name").toString() : null)
                        .category(itemData.get("category") != null ? itemData.get("category").toString() : null)
                        .quantity(parseOptionalDouble(itemData, "quantity", 1.0))
                        .price(parseOptionalDouble(itemData, "price", 0.0))
                        .taxRate(parseOptionalDouble(itemData, "taxRate", 0.0))
                        .notes(itemData.getOrDefault("notes", "").toString())
                        .status(OrderItem.ItemStatus.PENDING)
                        .addedBy(createdBy)
                        .addedByName(createdBy != null ? createdBy.getName() : "Customer")
                        .barcode(itemData.get("barcode") != null ? itemData.get("barcode").toString() : null)
                        .inventoryItemId((itemData.get("inventoryItemId") != null
                                && !itemData.get("inventoryItemId").toString().trim().isEmpty()
                                && !itemData.get("inventoryItemId").toString().equals("null"))
                                        ? Long.valueOf(itemData.get("inventoryItemId").toString())
                                        : null)
                        .batchNo(itemData.get("batchNo") != null ? itemData.get("batchNo").toString() : null)
                        .mfgDate(itemData.get("mfgDate") != null ? itemData.get("mfgDate").toString() : null)
                        .expDate(itemData.get("expDate") != null ? itemData.get("expDate").toString() : null)
                        .hsnCode(itemData.get("hsnCode") != null ? itemData.get("hsnCode").toString() : null)
                        .mrp(parseOptionalDouble(itemData, "mrp", null))
                        .disPct(parseOptionalDouble(itemData, "disPct", 0.0))
                        .build();
                order.getItems().add(oi);
                if (menuItem != null) {
                    menuItem.setOrderCount((menuItem.getOrderCount() != null ? menuItem.getOrderCount() : 0L) + 1);
                    menuItemRepository.save(menuItem);
                }
            }
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> extraChargesData = (List<Map<String, Object>>) data.get("extraCharges");
        if (extraChargesData != null) {
            List<ExtraCharge> extraCharges = new ArrayList<>();
            for (Map<String, Object> chargeData : extraChargesData) {
                ExtraCharge charge = new ExtraCharge();
                charge.setName(chargeData.get("name") != null ? chargeData.get("name").toString() : null);
                charge.setAmount(parseOptionalDouble(chargeData, "amount", 0.0));
                extraCharges.add(charge);
            }
            order.setExtraCharges(extraCharges);
        }

        if (data.containsKey("paymentMethod") && data.get("paymentMethod") != null) {
            try {
                order.setPaymentMethod(
                        Orders.PaymentMethod.valueOf(data.get("paymentMethod").toString().toUpperCase()));
            } catch (Exception ignored) {
            }
        }

        // Auto-mark as PAID if a customer places an order using UPI
        if (createdBy == null && Orders.PaymentMethod.UPI.equals(order.getPaymentMethod())) {
            order.setPaymentStatus(Orders.PaymentStatus.PAID);
        }

        // Recalculate totals
        recalculateTotals(order);

        Orders saved = orderRepository.save(order);

        if (Orders.PaymentStatus.PAID.equals(saved.getPaymentStatus())) {
            deductStockFromOrder(saved);

            if (createdBy == null && !"pharmacy".equalsIgnoreCase(saved.getBillTemplate())
                    && Boolean.TRUE.equals(restaurant.getBillPrinterEnabled())
                    && restaurant.getCounterPrinterIp() != null && !restaurant.getCounterPrinterIp().trim().isEmpty()) {
                final Orders finalSaved = saved;
                new Thread(() -> printService.printBill(finalSaved, restaurant, restaurant.getCounterPrinterIp()))
                        .start();
            }
        }

        // Auto-save/update customer details to persistent database
        saveCustomerProfile(restaurant, saved);

        // --- CUSTOMER ORDER FLOW: Branch on customerOrderMode ---
        boolean waiterAckMode = Boolean.TRUE.equals(restaurant.getCustomerOrderMode());
        boolean isCustomerOrder = (createdBy == null); // public endpoint = customer-placed order

        if (isCustomerOrder && waiterAckMode) {
            // WAITER ACKNOWLEDGEMENT MODE: flag the order, notify waiters — do NOT
            // broadcast KOT yet
            saved.setWaitingWaiterAck(true);
            saved = orderRepository.save(saved);
            try {
                socketService.broadcastWaiterRequest(restaurant.getId(), saved);
            } catch (Exception e) {
                System.err.println("⚠️ Waiter request broadcast failed: " + e.getMessage());
            }
            // Do NOT print KOT yet — will happen when waiter acknowledges
        } else {
            // DIRECT KOT MODE (default): broadcast immediately to kitchen
            try {
                if (activeOrderFound) {
                    socketService.broadcastKOTUpdate(restaurant.getId(), saved);
                } else {
                    socketService.broadcastNewKOT(restaurant.getId(), saved);
                }
            } catch (Exception e) {
                System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
            }

            // --- SILENT IP PRINTING (KOT) ---
            if (Boolean.TRUE.equals(restaurant.getKotPrinterEnabled()) && restaurant.getKitchenPrinterIp() != null
                    && !restaurant.getKitchenPrinterIp().trim().isEmpty()) {
                final Orders finalSaved = saved;
                new Thread(() -> printService.printKOT(finalSaved, restaurant.getKitchenPrinterIp())).start();
            }
        }

        return saved;
    }

    private void recalculateTotals(@NonNull Orders order) {
        double subtotal = 0;
        double taxAmount = 0;

        boolean printGst = order.getPrintWithGst() != Boolean.FALSE;

        for (OrderItem item : order.getItems()) {
            if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                continue;
            double itemTotal = item.getPrice() * item.getQuantity();
            double rate = printGst ? (item.getTaxRate() != null ? item.getTaxRate() : 0.0) : 0.0;

            double itemTax = (itemTotal * rate) / (100.0 + rate);
            double itemBasic = itemTotal - itemTax;

            subtotal += itemBasic;
            taxAmount += itemTax;
        }
        order.setSubtotal(subtotal);
        order.setTaxAmount(taxAmount);

        double extraTotal = 0.0;
        if (order.getExtraCharges() != null) {
            for (ExtraCharge charge : order.getExtraCharges()) {
                extraTotal += charge.getAmount();
            }
        }

        double discount = 0;
        double inclusiveSubtotal = subtotal + taxAmount;
        if (order.getDiscountType() == Orders.DiscountType.PERCENTAGE) {
            discount = inclusiveSubtotal * (order.getDiscountValue() / 100.0);
        } else if (order.getDiscountType() == Orders.DiscountType.FLAT) {
            discount = order.getDiscountValue();
        }
        order.setDiscountAmount(discount);
        order.setTotal(inclusiveSubtotal + extraTotal - discount);
    }

    @Transactional
    public Orders update(@NonNull User restaurant, Long id, @NonNull Map<String, Object> data) {
        Orders order = getById(restaurant, id);
        User creator = order.getCreatedBy(); // Keep original creator or update if needed

        order.setTableNumber(data.get("tableNumber") != null ? data.get("tableNumber").toString() : "Takeaway");
        order.setSubtotal(parseOptionalDouble(data, "subtotal", order.getSubtotal()));
        order.setTaxAmount(parseOptionalDouble(data, "taxAmount", order.getTaxAmount()));
        order.setPointsRedeemed(parseOptionalDouble(data, "pointsRedeemed", order.getPointsRedeemed()));
        order.setTotal(parseOptionalDouble(data, "total", order.getTotal()));
        order.setNotes(data.get("notes") != null ? data.get("notes").toString() : null);
        if (data.containsKey("orderType")) {
            order.setOrderType(parseOrderType(data.get("orderType")));
        }
        if (data.containsKey("billTemplate"))
            order.setBillTemplate(data.get("billTemplate").toString());
        if (data.containsKey("doctorName"))
            order.setDoctorName(data.get("doctorName") != null ? data.get("doctorName").toString() : null);
        if (data.containsKey("numberOfDays"))
            order.setNumberOfDays(data.get("numberOfDays") != null ? data.get("numberOfDays").toString() : null);
        if (data.containsKey("customerFirm"))
            order.setCustomerFirm(data.get("customerFirm") != null ? data.get("customerFirm").toString() : null);
        if (data.containsKey("customerPhone"))
            order.setCustomerPhone(data.get("customerPhone") != null ? data.get("customerPhone").toString() : null);
        if (data.containsKey("customerName"))
            order.setCustomerName(data.get("customerName") != null ? data.get("customerName").toString() : null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> itemsData = (List<Map<String, Object>>) data.get("items");
        if (itemsData != null) {
            // Simple strategy: Clear and re-add or match by ID.
            // Since frontend sends all items, we can clear and re-add for simplicity if
            // performance allows,
            // or update existing ones. Let's update/add for better preservation of state.

            List<OrderItem> currentItems = order.getItems();
            List<OrderItem> newItems = new ArrayList<>();

            for (Map<String, Object> itemData : itemsData) {
                Long itemId = itemData.get("_id") != null ? Long.valueOf(itemData.get("_id").toString()) : null;
                OrderItem oi = null;

                if (itemId != null) {
                    oi = currentItems.stream().filter(i -> i.getId().equals(itemId)).findFirst().orElse(null);
                }

                if (oi == null) {
                    // Brand new item — create it and always start as PREPARING
                    MenuItem menuItem = null;
                    if (itemData.get("menuItemId") != null) {
                        Long mId = Long.valueOf(itemData.get("menuItemId").toString());
                        menuItem = menuItemRepository.findById(Objects.requireNonNull(mId)).orElse(null); // NOSONAR
                                                                                                          // nullable by
                                                                                                          // design
                    }
                    oi = OrderItem.builder()
                            .order(order)
                            .menuItem(menuItem)
                            .addedBy(creator)
                            .addedByName(creator != null ? creator.getName() : "Staff")
                            .status(OrderItem.ItemStatus.PREPARING) // Always PREPARING for new items
                            .build();
                }
                // For existing items: do NOT touch status — preserve whatever the DB has
                // (e.g. READY, SERVED) so kitchen marks are never overwritten by POS re-saves

                oi.setName(itemData.get("name") != null ? itemData.get("name").toString() : null);
                oi.setQuantity(parseOptionalDouble(itemData, "quantity", 1.0));
                oi.setPrice(parseOptionalDouble(itemData, "price", 0.0));
                oi.setTaxRate(parseOptionalDouble(itemData, "taxRate", 0.0));
                oi.setNotes(itemData.getOrDefault("notes", "").toString());
                if (itemData.containsKey("barcode") && itemData.get("barcode") != null)
                    oi.setBarcode(itemData.get("barcode").toString());
                if (itemData.get("inventoryItemId") != null
                        && !itemData.get("inventoryItemId").toString().trim().isEmpty()
                        && !itemData.get("inventoryItemId").toString().equals("null"))
                    oi.setInventoryItemId(Long.valueOf(itemData.get("inventoryItemId").toString()));
                if (itemData.containsKey("batchNo"))
                    oi.setBatchNo(itemData.get("batchNo") != null ? itemData.get("batchNo").toString() : null);
                if (itemData.containsKey("mfgDate"))
                    oi.setMfgDate(itemData.get("mfgDate") != null ? itemData.get("mfgDate").toString() : null);
                if (itemData.containsKey("expDate"))
                    oi.setExpDate(itemData.get("expDate") != null ? itemData.get("expDate").toString() : null);
                if (itemData.containsKey("hsnCode"))
                    oi.setHsnCode(itemData.get("hsnCode") != null ? itemData.get("hsnCode").toString() : null);
                if (itemData.containsKey("mrp"))
                    oi.setMrp(parseOptionalDouble(itemData, "mrp", null));
                if (itemData.containsKey("disPct"))
                    oi.setDisPct(parseOptionalDouble(itemData, "disPct", 0.0));

                newItems.add(oi);
            }

            currentItems.clear();
            currentItems.addAll(newItems);
        }

        // Logic for "don't repeat items":
        // If an order was marked READY/SERVED but now has PREPARING items (new ones
        // added),
        // revert the order status so it reappears in the kitchen display.
        boolean hasActiveItems = order.getItems().stream()
                .anyMatch(i -> i.getStatus() == OrderItem.ItemStatus.PENDING
                        || i.getStatus() == OrderItem.ItemStatus.PREPARING);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> extraChargesUpdateData = (List<Map<String, Object>>) data.get("extraCharges");
        if (extraChargesUpdateData != null) {
            List<ExtraCharge> extraCharges = new ArrayList<>();
            for (Map<String, Object> chargeData : extraChargesUpdateData) {
                ExtraCharge charge = new ExtraCharge();
                charge.setName(chargeData.get("name") != null ? chargeData.get("name").toString() : null);
                charge.setAmount(parseOptionalDouble(chargeData, "amount", 0.0));
                extraCharges.add(charge);
            }
            order.getExtraCharges().clear();
            order.getExtraCharges().addAll(extraCharges);
        } else if (data.containsKey("extraCharges")) {
            order.getExtraCharges().clear();
        }

        if (hasActiveItems
                && (order.getStatus() == Orders.OrderStatus.READY || order.getStatus() == Orders.OrderStatus.SERVED)) {
            order.setStatus(Orders.OrderStatus.PREPARING);
        }

        Orders saved = orderRepository.save(order);

        // Auto-save/update customer details to persistent database
        saveCustomerProfile(restaurant, saved);

        // Broadcast full update via Socket so kitchen can see new items
        try {
            socketService.broadcastKOTUpdate(restaurant.getId(), saved);
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        // --- SILENT IP PRINTING (KOT) ---
        if (Boolean.TRUE.equals(restaurant.getKotPrinterEnabled()) && restaurant.getKitchenPrinterIp() != null
                && !restaurant.getKitchenPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            new Thread(() -> printService.printKOT(finalSaved, restaurant.getKitchenPrinterIp())).start();
        }

        return saved;
    }

    private Double parseOptionalDouble(Map<String, Object> data, String key, Double defaultValue) {
        if (!data.containsKey(key) || data.get(key) == null)
            return defaultValue;
        try {
            return Double.valueOf(data.get(key).toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private Orders.OrderType parseOrderType(Object raw) {
        if (raw == null)
            return Orders.OrderType.DINE_IN;
        String val = raw.toString().trim().toUpperCase().replace("-", "_");
        if ("LINE".equals(val) || "LINE_POS".equals(val))
            return Orders.OrderType.LINE_POS;
        try {
            return Orders.OrderType.valueOf(val);
        } catch (Exception e) {
            return Orders.OrderType.TAKEAWAY;
        }
    }

    @Transactional
    public Orders updateStatus(@NonNull User restaurant, Long id, String status, String paymentStatus,
            String paymentMethod, Boolean printWithGst) {
        Orders order = getById(restaurant, id);
        order.setStatus(Orders.OrderStatus.valueOf(status.toUpperCase()));

        if (paymentStatus != null) {
            order.setPaymentStatus(Orders.PaymentStatus.valueOf(paymentStatus.toUpperCase()));
        }
        if (paymentMethod != null) {
            order.setPaymentMethod(Orders.PaymentMethod.valueOf(paymentMethod.toUpperCase()));
        }
        if (printWithGst != null) {
            order.setPrintWithGst(printWithGst);
        }

        if (Orders.PaymentStatus.PAID.equals(order.getPaymentStatus())) {
            deductStockFromOrder(order);
            handleCustomerLoyaltyPoints(order, restaurant);
            // --- WHATSAPP INVOICE TRIGGER (async, non-blocking) ---
            if (Boolean.TRUE.equals(restaurant.getWhatsappEnabled())
                    && Boolean.TRUE.equals(restaurant.getWhatsappAutoSendInvoice())
                    && order.getCustomerPhone() != null && !order.getCustomerPhone().isBlank()) {
                final Orders finalOrder = order;
                final User finalRestaurant = restaurant;
                new Thread(() -> whatsAppDeliveryService.sendInvoiceAsync(finalOrder, finalRestaurant)).start();
            }
        }

        Orders saved = orderRepository.save(order);

        // --- SILENT IP PRINTING (BILL) ---
        if (!"pharmacy".equalsIgnoreCase(order.getBillTemplate())
                && Orders.PaymentStatus.PAID.equals(order.getPaymentStatus())
                && Boolean.TRUE.equals(restaurant.getBillPrinterEnabled()) && restaurant.getCounterPrinterIp() != null
                && !restaurant.getCounterPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            final User finalRestaurant = restaurant;
            new Thread(() -> printService.printBill(finalSaved, finalRestaurant, finalRestaurant.getCounterPrinterIp()))
                    .start();
        }

        // Broadcast status update to ALL associated tables
        try {
            List<String> allTables = new ArrayList<>();
            allTables.add(saved.getTableNumber());
            if (saved.getMergedTables() != null && !saved.getMergedTables().isEmpty()) {
                allTables.addAll(Arrays.asList(saved.getMergedTables().split("\\s*,\\s*")));
            }

            for (String table : allTables) {
                socketService.broadcastStatusUpdate(restaurant.getId(), saved.getId(), saved.getOrderNumber(),
                        status.toUpperCase(), table);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public Orders appendNotes(@NonNull User restaurant, Long id, String notes) {
        Orders order = getById(restaurant, id);
        String currentNotes = order.getNotes();
        if (currentNotes == null || currentNotes.trim().isEmpty()) {
            order.setNotes(notes);
        } else {
            order.setNotes(currentNotes + " | " + notes);
        }
        Orders saved = orderRepository.save(order);

        try {
            socketService.broadcastKOTUpdate(restaurant.getId(), saved);

            String notifyMsg = "🔔 Note for Table " + order.getTableNumber() + ": " + notes;
            if (notes.contains("Kitchen needs")) {
                notifyMsg = "⏰ Table " + order.getTableNumber() + ": Kitchen needs 10 more minutes.";
            }
            socketService.broadcastNotification(restaurant.getId(), notifyMsg);
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public Orders updatePayment(@NonNull User restaurant, Long id, String paymentMethod, String paymentStatus) {
        Orders order = getById(restaurant, id);
        if (paymentMethod != null)
            order.setPaymentMethod(Orders.PaymentMethod.valueOf(paymentMethod.toUpperCase()));
        if (paymentStatus != null)
            order.setPaymentStatus(Orders.PaymentStatus.valueOf(paymentStatus.toUpperCase()));
        if (Orders.PaymentStatus.PAID.equals(order.getPaymentStatus())) {
            order.setStatus(Orders.OrderStatus.PAID);
            deductStockFromOrder(order);
            handleCustomerLoyaltyPoints(order, restaurant);
        }
        Orders saved = orderRepository.save(order);

        // --- SILENT IP PRINTING (BILL) ---
        if (!"pharmacy".equalsIgnoreCase(order.getBillTemplate())
                && Orders.PaymentStatus.PAID.equals(order.getPaymentStatus())
                && Boolean.TRUE.equals(restaurant.getBillPrinterEnabled()) && restaurant.getCounterPrinterIp() != null
                && !restaurant.getCounterPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            final User finalRestaurant = restaurant;
            new Thread(() -> printService.printBill(finalSaved, finalRestaurant, finalRestaurant.getCounterPrinterIp()))
                    .start();
        }

        try {
            socketService.broadcastStatusUpdate(restaurant.getId(), saved.getId(), saved.getOrderNumber(),
                    saved.getStatus().name(), saved.getTableNumber());
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }
        return saved;
    }

    @Transactional
    public Orders requestBill(@NonNull User restaurant, Long id) {
        // Use findByRestaurantAndId which now has FETCH JOIN for items
        Orders order = orderRepository.findByRestaurantAndId(restaurant, id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        order.setBillRequested(true);
        order.setBillRequestedAt(LocalDateTime.now());
        Orders saved = orderRepository.save(order);

        // Ensure items are loaded into the object being sent
        if (saved.getItems() != null)
            saved.getItems().size();

        try {
            socketService.broadcastBillingRequest(restaurant.getId(), saved);
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        // --- SILENT IP PRINTING (BILL) ---
        if (Boolean.TRUE.equals(restaurant.getBillPrinterEnabled()) && restaurant.getCounterPrinterIp() != null
                && !restaurant.getCounterPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            new Thread(() -> printService.printBill(finalSaved, restaurant, restaurant.getCounterPrinterIp())).start();
        }

        return saved;
    }

    @Transactional
    public Orders requestBillPublic(@NonNull Long id, String paymentMethod) {
        // Use new findByIdWithItems to avoid LazyInitializationException in Socket
        // thread
        Orders order = Objects.requireNonNull(orderRepository.findByIdWithItems(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found")));
        order.setBillRequested(true);
        order.setBillRequestedAt(LocalDateTime.now());
        if (paymentMethod != null && !paymentMethod.trim().isEmpty()) {
            try {
                order.setPaymentMethod(Orders.PaymentMethod.valueOf(paymentMethod.toUpperCase()));
            } catch (Exception ignored) {
            }
        }
        Orders saved = orderRepository.save(order);

        // Ensure items are loaded into the object being sent
        if (saved.getItems() != null)
            saved.getItems().size();

        try {
            socketService.broadcastBillingRequest(saved.getRestaurant().getId(), saved);
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        // --- SILENT IP PRINTING (BILL) ---
        User restaurantRef = saved.getRestaurant();
        if (Boolean.TRUE.equals(restaurantRef.getBillPrinterEnabled()) && restaurantRef.getCounterPrinterIp() != null
                && !restaurantRef.getCounterPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            new Thread(() -> printService.printBill(finalSaved, restaurantRef, restaurantRef.getCounterPrinterIp()))
                    .start();
        }

        return saved;
    }

    @Transactional
    public Orders markAsPrinted(@NonNull User restaurant, Long id) {
        Orders order = getById(restaurant, id);
        order.setBillPrinted(true);
        Orders saved = orderRepository.save(order);
        try {
            socketService.broadcastBillingPrinted(restaurant.getId(), id);
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }
        return saved;
    }

    @Transactional
    public Orders acknowledgeOrder(@NonNull User restaurant, Long id, User waiter) {
        Orders order = orderRepository.findByRestaurantAndId(restaurant, id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (!Boolean.TRUE.equals(order.getWaitingWaiterAck())) {
            return order; // Already acknowledged or not in waiter-ack mode
        }

        order.setWaitingWaiterAck(false);
        if (waiter != null && waiter.getName() != null) {
            order.setWaiterName(waiter.getName());
        }
        if (order.getStatus() == Orders.OrderStatus.PENDING) {
            order.setStatus(Orders.OrderStatus.PREPARING);
        }
        order.getItems().forEach(item -> {
            if (item.getStatus() == OrderItem.ItemStatus.PENDING) {
                item.setStatus(OrderItem.ItemStatus.PREPARING);
            }
        });

        Orders saved = orderRepository.save(order);

        try {
            socketService.broadcastNewKOT(restaurant.getId(), saved);
            socketService.broadcastWaiterAcknowledged(restaurant.getId(), saved.getId());
            socketService.broadcastStatusUpdate(restaurant.getId(), saved.getId(),
                    saved.getOrderNumber(), saved.getStatus().name(), saved.getTableNumber());
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed after waiter ack: " + e.getMessage());
        }

        if (Boolean.TRUE.equals(restaurant.getKotPrinterEnabled()) && restaurant.getKitchenPrinterIp() != null
                && !restaurant.getKitchenPrinterIp().trim().isEmpty()) {
            final Orders finalSaved = saved;
            new Thread(() -> printService.printKOT(finalSaved, restaurant.getKitchenPrinterIp())).start();
        }

        return saved;
    }

    public List<Orders> getPendingWaiterAckOrders(@NonNull User restaurant) {
        return orderRepository.findPendingWaiterAck(restaurant);
    }

    @Transactional
    public Orders addFeedback(@NonNull Long orderId, Integer rating, String feedback) {
        Orders order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (order.getStatus() != Orders.OrderStatus.PAID) {
            throw new IllegalArgumentException("Feedback can only be submitted for completed (PAID) orders.");
        }

        order.setRating(rating);
        order.setFeedback(feedback);

        return orderRepository.save(order);
    }

    public java.util.Map<String, Object> getWaiterDashboardStats(@NonNull User waiter) {
        List<Orders> completedOrders = orderRepository.findByCreatedByAndStatusOrderByCreatedAtDesc(waiter,
                Orders.OrderStatus.PAID);

        long totalCompleted = completedOrders.size();

        List<Orders> ordersWithRating = completedOrders.stream()
                .filter(o -> o.getRating() != null && o.getRating() > 0)
                .collect(java.util.stream.Collectors.toList());

        double averageRating = 0.0;
        if (!ordersWithRating.isEmpty()) {
            averageRating = ordersWithRating.stream()
                    .mapToInt(o -> o.getRating() != null ? o.getRating() : 0)
                    .average()
                    .orElse(0.0);
        }

        // Find recent feedback (last 20 with text feedback)
        List<java.util.Map<String, Object>> recentFeedback = ordersWithRating.stream()
                .filter(o -> o.getFeedback() != null && !o.getFeedback().trim().isEmpty())
                .limit(20)
                .map(o -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("orderId", o.getId());
                    map.put("orderNumber", o.getOrderNumber());
                    map.put("rating", o.getRating());
                    map.put("feedback", o.getFeedback());
                    map.put("createdAt", o.getCreatedAt().toString());
                    return map;
                })
                .collect(java.util.stream.Collectors.toList());

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("totalCompleted", totalCompleted);
        result.put("averageRating", Math.round(averageRating * 10.0) / 10.0);
        result.put("recentFeedback", recentFeedback);
        result.put("history", completedOrders.stream().limit(50).collect(java.util.stream.Collectors.toList()));

        User restaurant = waiter.getParentOwner() != null ? waiter.getParentOwner() : waiter;
        result.put("activeOrders", getActiveOrders(java.util.Objects.requireNonNull(restaurant)));

        return result;
    }

    public List<Map<String, Object>> getEmployeePerformanceStats(@NonNull User restaurant) {
        // Get all staff members for this restaurant
        List<User> staffMembers = userRepository.findByParentOwner(restaurant);
        List<Map<String, Object>> performanceList = new ArrayList<>();

        for (User staff : staffMembers) {
            Map<String, Object> stats = getWaiterDashboardStats(java.util.Objects.requireNonNull(staff));

            Map<String, Object> staffPerformance = new HashMap<>();
            staffPerformance.put("id", staff.getId());
            staffPerformance.put("name", staff.getName());
            staffPerformance.put("role", staff.getRole());
            staffPerformance.put("isActive", staff.getIsActive());

            staffPerformance.put("totalCompleted", stats.get("totalCompleted"));
            staffPerformance.put("averageRating", stats.get("averageRating"));
            staffPerformance.put("recentFeedback", stats.get("recentFeedback"));
            staffPerformance.put("history", stats.get("history"));
            staffPerformance.put("activeOrders", stats.get("activeOrders"));

            performanceList.add(staffPerformance);
        }

        return performanceList;
    }

    @Transactional
    public Orders updateItemStatus(@NonNull User restaurant, Long orderId, Long itemId, String status) {
        // Use findByRestaurantAndId which now has FETCH JOIN for items
        Orders order = orderRepository.findByRestaurantAndId(restaurant, orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        OrderItem item = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        item.setStatus(OrderItem.ItemStatus.valueOf(status.toUpperCase()));

        // Check if all items are ready or cancelled
        boolean allReady = order.getItems().stream()
                .allMatch(
                        i -> i.getStatus() == OrderItem.ItemStatus.READY || i.getStatus() == OrderItem.ItemStatus.SERVED
                                || i.getStatus() == OrderItem.ItemStatus.CANCELLED);

        boolean allCancelled = order.getItems().stream()
                .allMatch(i -> i.getStatus() == OrderItem.ItemStatus.CANCELLED);

        if (allCancelled) {
            order.setStatus(Orders.OrderStatus.CANCELLED);
        } else if (allReady && order.getStatus() == Orders.OrderStatus.PREPARING) {
            order.setStatus(Orders.OrderStatus.READY);
        }

        Orders saved = orderRepository.save(order);

        // Broadcast item update
        try {
            socketService.broadcastItemStatusUpdate(restaurant.getId(), orderId, itemId, status,
                    saved.getStatus().name(), saved.getTableNumber());
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public Orders markItemReadyPartial(@NonNull User restaurant, Long orderId, Long itemId) {
        Orders order = getById(restaurant, orderId);
        OrderItem item = order.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        if (item.getCompletedQuantity() == null)
            item.setCompletedQuantity(0.0);

        if (item.getCompletedQuantity() < item.getQuantity()) {
            item.setCompletedQuantity(item.getCompletedQuantity() + 1.0);
        }

        if (item.getCompletedQuantity().equals(item.getQuantity())) {
            item.setStatus(OrderItem.ItemStatus.READY);
        }

        // Check if all items are ready
        boolean allReady = order.getItems().stream()
                .allMatch(i -> i.getStatus() == OrderItem.ItemStatus.READY
                        || i.getStatus() == OrderItem.ItemStatus.SERVED);

        if (allReady && order.getStatus() == Orders.OrderStatus.PREPARING) {
            order.setStatus(Orders.OrderStatus.READY);
        }

        Orders saved = orderRepository.save(order);

        // Broadcast item update
        try {
            socketService.broadcastKOTUpdate(restaurant.getId(), saved);
            Long waiterId = saved.getCreatedBy() != null ? saved.getCreatedBy().getId() : null;
            socketService.broadcastItemsReady(restaurant.getId(), saved.getId(), waiterId, saved.getOrderNumber(),
                    saved.getTableNumber(), "1x " + item.getName());
        } catch (Exception e) {
            System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public Orders updateMultipleItemsStatus(@NonNull User restaurant, Long orderId, List<Long> itemIds, String status) {
        Orders order = getById(restaurant, orderId);

        boolean changed = false;
        List<String> readyNames = new ArrayList<>();

        for (Long itemId : itemIds) {
            OrderItem item = order.getItems().stream()
                    .filter(i -> i.getId().equals(itemId))
                    .findFirst()
                    .orElse(null);

            if (item != null && !item.getStatus().name().equalsIgnoreCase(status)) {
                if (status.equalsIgnoreCase("READY")) {
                    readyNames.add(item.getQuantity() + "x " + item.getName());
                }
                item.setStatus(OrderItem.ItemStatus.valueOf(status.toUpperCase()));
                changed = true;
            }
        }

        if (changed) {
            boolean allReady = order.getItems().stream()
                    .allMatch(i -> i.getStatus() == OrderItem.ItemStatus.READY
                            || i.getStatus() == OrderItem.ItemStatus.SERVED);

            if (allReady && order.getStatus() == Orders.OrderStatus.PREPARING) {
                order.setStatus(Orders.OrderStatus.READY);
            }

            Orders saved = orderRepository.save(order);

            try {
                socketService.broadcastKOTUpdate(restaurant.getId(), saved);

                if (!readyNames.isEmpty()) {
                    Long waiterId = saved.getCreatedBy() != null ? saved.getCreatedBy().getId() : null;
                    String itemsText = String.join(", ", readyNames);
                    socketService.broadcastItemsReady(restaurant.getId(), saved.getId(), waiterId,
                            saved.getOrderNumber(), saved.getTableNumber(), itemsText);
                }
            } catch (Exception e) {
                System.err.println("⚠️ Socket broadcast failed: " + e.getMessage());
            }
            return saved;
        }

        return order;
    }

    @Transactional
    public Orders split(@NonNull User restaurant, Long orderId, List<Long> itemIds, String newTableNumber) {
        Orders originalOrder = getById(restaurant, orderId);

        String normalizedNewTable = normalizeTableNumber(newTableNumber);

        List<OrderItem> itemsToMove = new ArrayList<>();
        // Important: use index-based or iterator removal to avoid
        // ConcurrentModificationException if needed,
        // but since we collect to move and remove from the list, iterator is safest.
        Iterator<OrderItem> iterator = originalOrder.getItems().iterator();
        while (iterator.hasNext()) {
            OrderItem item = iterator.next();
            if (itemIds.contains(item.getId())) {
                itemsToMove.add(item);
                iterator.remove();
            }
        }

        if (itemsToMove.isEmpty()) {
            throw new ResourceNotFoundException("No valid items found to split");
        }

        Orders newOrder = Orders.builder()
                .restaurant(restaurant)
                .orderNumber(generateOrderNumber(restaurant))
                .tableNumber(normalizedNewTable)
                .orderType(originalOrder.getOrderType())
                .customerName(originalOrder.getCustomerName())
                .customerPhone(originalOrder.getCustomerPhone())
                .status(originalOrder.getStatus())
                .paymentStatus(originalOrder.getPaymentStatus())
                .createdBy(originalOrder.getCreatedBy())
                .waiterName(originalOrder.getWaiterName())
                .subtotal(0.0)
                .total(0.0)
                .build();

        for (OrderItem item : itemsToMove) {
            item.setOrder(newOrder);
            newOrder.getItems().add(item);
        }

        recalculateTotals(java.util.Objects.requireNonNull(newOrder));
        Orders savedNewOrder = orderRepository.save(java.util.Objects.requireNonNull(newOrder));

        if (originalOrder.getItems().isEmpty()) {
            originalOrder.setStatus(Orders.OrderStatus.CANCELLED);
            orderRepository.save(java.util.Objects.requireNonNull(originalOrder)); // Mark as cancelled
        } else {
            recalculateTotals(java.util.Objects.requireNonNull(originalOrder));
            orderRepository.save(java.util.Objects.requireNonNull(originalOrder));
        }

        try {
            socketService.broadcastNewKOT(restaurant.getId(), savedNewOrder);
            if (originalOrder.getItems().isEmpty()) {
                socketService.broadcastStatusUpdate(restaurant.getId(), originalOrder.getId(),
                        originalOrder.getOrderNumber(), "CANCELLED", originalOrder.getTableNumber());
            } else {
                socketService.broadcastKOTUpdate(restaurant.getId(), originalOrder);
            }
        } catch (Exception e) {
            System.err.println("Split Socket broadcast failed: " + e.getMessage());
        }

        return savedNewOrder;
    }

    @Transactional
    public Orders combineTables(@NonNull User restaurant, String sourceTable, Long targetOrderId, String targetTable,
            Integer covers) {
        String normalizedSource = normalizeTableNumber(sourceTable);
        List<Orders> sourceOrders = getActiveOrdersByTable(restaurant, normalizedSource);
        Orders sourceOrder = sourceOrders.isEmpty() ? null : sourceOrders.get(0);

        if (sourceOrder != null) {
            // Use existing ID-based combine if source order exists
            return combine(restaurant, sourceOrder.getId(), targetOrderId, targetTable, covers);
        }

        // Case: Source Table is empty. We just link it to the target.
        Orders targetOrder = null;
        if (targetOrderId != null) {
            targetOrder = getById(restaurant, targetOrderId);
        } else if (targetTable != null) {
            String normalizedTarget = normalizeTableNumber(targetTable);
            List<Orders> targetOrders = getActiveOrdersByTable(restaurant, normalizedTarget);
            if (!targetOrders.isEmpty()) {
                targetOrder = targetOrders.get(0);
            } else {
                // Both are empty! Create a skeleton order on target table
                targetOrder = Orders.builder()
                        .restaurant(restaurant)
                        .tableNumber(normalizedTarget)
                        .status(Orders.OrderStatus.PENDING)
                        .paymentStatus(Orders.PaymentStatus.UNPAID)
                        .orderType(Orders.OrderType.DINE_IN)
                        .subtotal(0.0)
                        .total(0.0)
                        .build();
                // We also need an order number
                targetOrder.setOrderNumber("TEMP-" + System.currentTimeMillis());
                targetOrder = orderRepository.save(targetOrder);
            }
        }

        if (targetOrder == null) {
            throw new ResourceNotFoundException("Target order or table not found");
        }

        // Add source table to target's merged list
        String currentMerged = targetOrder.getMergedTables();
        if (currentMerged == null || currentMerged.isEmpty()) {
            targetOrder.setMergedTables(normalizedSource);
        } else if (!Arrays.asList(currentMerged.split(", ")).contains(normalizedSource)) {
            targetOrder.setMergedTables(currentMerged + ", " + normalizedSource);
        }

        if (covers != null) {
            targetOrder.setCovers((targetOrder.getCovers() != null ? targetOrder.getCovers() : 0) + covers);
        }

        Orders saved = orderRepository.save(targetOrder);
        socketService.broadcastKOTUpdate(restaurant.getId(), saved);
        return saved;
    }

    @Transactional
    public Orders combine(@NonNull User restaurant, Long sourceOrderId, Long targetOrderId, String targetTable,
            Integer covers) {
        Orders sourceOrder = getById(restaurant, sourceOrderId);
        Orders targetOrder = null;

        if (targetOrderId != null) {
            targetOrder = getById(restaurant, targetOrderId);
        } else if (targetTable != null) {
            String normalizedTarget = normalizeTableNumber(targetTable);
            List<Orders> active = getActiveOrdersByTable(restaurant, normalizedTarget);
            if (!active.isEmpty()) {
                targetOrder = active.get(0);
            } else {
                // Merge to empty table: simple reassignment
                String oldTable = sourceOrder.getTableNumber();
                sourceOrder.setTableNumber(normalizedTarget);

                String currentMerged = sourceOrder.getMergedTables();
                if (currentMerged == null || currentMerged.isEmpty()) {
                    sourceOrder.setMergedTables(oldTable);
                } else if (!Arrays.asList(currentMerged.split(", ")).contains(oldTable)) {
                    sourceOrder.setMergedTables(currentMerged + ", " + oldTable);
                }

                Orders saved = orderRepository.save(sourceOrder);
                try {
                    socketService.broadcastKOTUpdate(restaurant.getId(), saved);
                } catch (Exception e) {
                    System.err.println("Merge-Move Socket broadcast failed: " + e.getMessage());
                }
                return Objects.requireNonNull(saved);
            }
        }

        if (targetOrder == null) {
            throw new ResourceNotFoundException("Target order or table not found");
        }

        if (targetOrder.getPaymentStatus() == Orders.PaymentStatus.PAID) {
            throw new IllegalStateException("Cannot combine into a paid order");
        }

        // Move all items
        for (OrderItem item : sourceOrder.getItems()) {
            item.setOrder(targetOrder);
            targetOrder.getItems().add(item);
        }

        // Track merged table numbers
        String currentMerged = targetOrder.getMergedTables();
        String sTable = sourceOrder.getTableNumber();
        if (currentMerged == null || currentMerged.isEmpty()) {
            targetOrder.setMergedTables(sTable);
        } else if (!Arrays.asList(currentMerged.split(", ")).contains(sTable)) {
            targetOrder.setMergedTables(currentMerged + ", " + sTable);
        }

        // Also carry over any existing merges from the source
        if (sourceOrder.getMergedTables() != null && !sourceOrder.getMergedTables().isEmpty()) {
            for (String subTable : sourceOrder.getMergedTables().split(", ")) {
                if (!Arrays.asList(targetOrder.getMergedTables().split(", ")).contains(subTable)) {
                    targetOrder.setMergedTables(targetOrder.getMergedTables() + ", " + subTable);
                }
            }
        }

        sourceOrder.getItems().clear();
        sourceOrder.setStatus(Orders.OrderStatus.CANCELLED);

        // Sum covers: priority to sourceOrder's existing covers, fallback to parameter
        int sourceCovers = (sourceOrder.getCovers() != null ? sourceOrder.getCovers() : (covers != null ? covers : 0));
        targetOrder.setCovers((targetOrder.getCovers() != null ? targetOrder.getCovers() : 0) + sourceCovers);

        recalculateTotals(targetOrder);
        Orders savedTarget = orderRepository.save(targetOrder);
        orderRepository.save(sourceOrder);

        try {
            socketService.broadcastStatusUpdate(restaurant.getId(), sourceOrder.getId(), sourceOrder.getOrderNumber(),
                    "CANCELLED", sourceOrder.getTableNumber());
            socketService.broadcastKOTUpdate(restaurant.getId(), savedTarget);
        } catch (Exception e) {
            System.err.println("Combine Socket broadcast failed: " + e.getMessage());
        }

        return Objects.requireNonNull(savedTarget);
    }

    public String generateOrderNumber(User restaurant) {
        String prefix = restaurant.getBillPrefix();
        if (prefix == null || prefix.trim().isEmpty())
            prefix = "ORD";
        int nextSeq = restaurant.getNextBillSequence() != null ? restaurant.getNextBillSequence() : 1;

        List<String> existingInvoices = orderRepository.findOrderNumbersByPrefix(restaurant.getId(), prefix);

        final String finalPrefix = prefix;
        final int startSeq = nextSeq;
        List<Integer> usedNumbers = existingInvoices.stream()
                .filter(inv -> inv != null && inv.startsWith(finalPrefix))
                .map(inv -> {
                    try {
                        return Integer.parseInt(inv.substring(finalPrefix.length()));
                    } catch (NumberFormatException e) {
                        return -1;
                    }
                })
                .filter(n -> n >= startSeq)
                .sorted()
                .collect(java.util.stream.Collectors.toList());

        for (int num : usedNumbers) {
            if (num == nextSeq) {
                nextSeq++;
            } else if (num > nextSeq) {
                break; // Found a gap!
            }
        }

        return prefix + String.format("%04d", nextSeq);
    }

    private String generateTokenNumber(User restaurant) {
        LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        Long maxToken = orderRepository.findMaxTokenNumberToday(restaurant.getId(), startOfDay);
        long nextToken = (maxToken == null ? 0 : maxToken) + 1;
        return String.valueOf(nextToken);
    }

    @Transactional
    public Orders uncombineTable(@NonNull Long orderId, String tableToUnmerge) {
        Orders order = Objects.requireNonNull(orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId)));

        if (order.getMergedTables() == null || order.getMergedTables().isEmpty()) {
            return order;
        }

        // Use regex split to handle various whitespace around commas
        List<String> tables = new ArrayList<>(Arrays.asList(order.getMergedTables().split("\\s*,\\s*")));

        final String normalizedTarget = tableToUnmerge.trim().toLowerCase();

        tables = tables.stream()
                .filter(t -> {
                    String nt = t.trim().toLowerCase();
                    return !nt.equals(normalizedTarget) &&
                            !nt.equals(normalizedTarget.replace("table ", "")) &&
                            !normalizedTarget.equals(nt.replace("table ", ""));
                })
                .collect(Collectors.toList());

        if (tables.isEmpty()) {
            order.setMergedTables(null);
        } else {
            order.setMergedTables(String.join(", ", tables));
        }

        if (order.getItems().isEmpty() && (order.getMergedTables() == null || order.getMergedTables().isEmpty())) {
            order.setStatus(Orders.OrderStatus.CANCELLED);
        }

        Orders saved = orderRepository.save(order);
        try {
            // Trigger broad refresh for POS and Kitchen
            socketService.broadcastKOTUpdate(order.getRestaurant().getId(), saved);
            socketService.broadcastStatusUpdate(order.getRestaurant().getId(), saved.getId(), saved.getOrderNumber(),
                    saved.getStatus().toString(), saved.getTableNumber());

            // Specifically notify that the unmerged table is now "CANCELLED" (free) to
            // trigger a refresh on that specific UI tab
            socketService.broadcastStatusUpdate(order.getRestaurant().getId(), saved.getId(), saved.getOrderNumber(),
                    "CANCELLED", tableToUnmerge);

            if (saved.getStatus() == Orders.OrderStatus.CANCELLED) {
                socketService.broadcastStatusUpdate(order.getRestaurant().getId(), saved.getId(),
                        saved.getOrderNumber(), "CANCELLED", saved.getTableNumber());
            }
        } catch (Exception e) {
            System.err.println("Unmerge-Status Socket broadcast failed: " + e.getMessage());
        }
        return saved;
    }

    private void deductStockFromOrder(Orders order) {
        for (OrderItem item : order.getItems()) {
            try {
                InventoryItem inventoryItem = null;

                // 1. Try by direct ID
                if (item.getInventoryItemId() != null) {
                    inventoryItem = inventoryService.getById(Objects.requireNonNull(order.getRestaurant()),
                            Objects.requireNonNull(item.getInventoryItemId()));
                }
                // 2. Try by Barcode
                else if (item.getBarcode() != null && !item.getBarcode().trim().isEmpty()) {
                    try {
                        inventoryItem = inventoryService.getByBarcode(Objects.requireNonNull(order.getRestaurant()),
                                Objects.requireNonNull(item.getBarcode()));
                    } catch (Exception ignored) {
                    }
                }
                // 3. Try by Name (Exact Match)
                if (inventoryItem == null && item.getName() != null) {
                    try {
                        inventoryItem = inventoryService.getByName(Objects.requireNonNull(order.getRestaurant()),
                                Objects.requireNonNull(item.getName()));
                    } catch (Exception ignored) {
                    }
                }

                if (inventoryItem != null) {
                    inventoryService.adjustStock(
                            Objects.requireNonNull(order.getRestaurant()),
                            Objects.requireNonNull(inventoryItem.getId()),
                            Objects.requireNonNull(Map.of(
                                    "type", "DEDUCT",
                                    "quantity", Double.valueOf(item.getQuantity()),
                                    "reason", "Sale (Order #" + order.getOrderNumber() + ")")),
                            order.getCreatedBy());
                } else {
                    System.err.println("⚠️ Could not find inventory item to deduct for: " + item.getName());
                }
            } catch (Exception e) {
                System.err.println("⚠️ Failed to deduct stock for item " + item.getName() + ": " + e.getMessage());
            }
        }
    }

    private void restoreStockFromOrder(Orders order) {
        if (order.getItems() == null)
            return;
        for (OrderItem item : order.getItems()) {
            try {
                InventoryItem inventoryItem = null;
                if (item.getInventoryItemId() != null) {
                    inventoryItem = inventoryService.getById(Objects.requireNonNull(order.getRestaurant()),
                            Objects.requireNonNull(item.getInventoryItemId()));
                } else if (item.getBarcode() != null && !item.getBarcode().trim().isEmpty()) {
                    try {
                        inventoryItem = inventoryService.getByBarcode(Objects.requireNonNull(order.getRestaurant()),
                                Objects.requireNonNull(item.getBarcode()));
                    } catch (Exception ignored) {
                    }
                }
                if (inventoryItem == null && item.getName() != null) {
                    try {
                        inventoryItem = inventoryService.getByName(Objects.requireNonNull(order.getRestaurant()),
                                Objects.requireNonNull(item.getName()));
                    } catch (Exception ignored) {
                    }
                }

                if (inventoryItem != null) {
                    inventoryService.adjustStock(
                            Objects.requireNonNull(order.getRestaurant()),
                            Objects.requireNonNull(inventoryItem.getId()),
                            Objects.requireNonNull(Map.of(
                                    "type", "ADD",
                                    "quantity", Double.valueOf(item.getQuantity()),
                                    "reason", "Revert Sale (Deleted Order #" + order.getOrderNumber() + ")")),
                            order.getCreatedBy());
                }
            } catch (Exception e) {
                System.err.println("⚠️ Failed to restore stock for item " + item.getName() + ": " + e.getMessage());
            }
        }
    }

    @Transactional
    public void delete(@NonNull User restaurant, @NonNull Long id) {
        Orders order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (!order.getRestaurant().getId().equals(restaurant.getId())) {
            throw new ResourceNotFoundException("Order not found for this restaurant");
        }

        restoreStockFromOrder(order);
        orderRepository.delete(order);
    }

    @Transactional
    public void clearHistory(@NonNull User restaurant) {
        List<Orders> all = orderRepository.findByRestaurantOrderByCreatedAtDesc(restaurant);
        orderRepository.deleteAll(java.util.Objects.requireNonNull(all));
    }

    private void saveCustomerProfile(User restaurant, Orders order) {
        if (restaurant != null && restaurant.getId() != null && order.getCustomerPhone() != null
                && !order.getCustomerPhone().trim().isEmpty() && !order.getCustomerPhone().equalsIgnoreCase("null")) {
            try {
                customerService.createOrUpdateCustomer(
                        restaurant.getId(),
                        order.getCustomerPhone().trim(),
                        order.getCustomerName() != null ? order.getCustomerName().trim() : "Walk-in Customer",
                        null);

            } catch (Exception e) {
                System.err.println("⚠️ Failed to auto-save customer profile: " + e.getMessage());
            }
        }
    }
}
