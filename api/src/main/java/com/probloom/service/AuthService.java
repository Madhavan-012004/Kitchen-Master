package com.probloom.service;

import com.probloom.exception.BadRequestException;
import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.User;
import com.probloom.repository.UserRepository;
import com.probloom.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;

import org.springframework.transaction.annotation.Transactional;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@SuppressWarnings("null")
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private LicenseService licenseService;

    @Autowired
    private OfflineFirstLoginService offlineFirstLoginService;

    @PostConstruct
    public void migrateRoles() {
        try {
            // Update roles from KITCHEN to KOT in database
            jdbcTemplate.execute("UPDATE users SET role = 'KOT' WHERE role = 'KITCHEN'");
        } catch (Exception e) {
            System.err.println("Role migration failed: " + e.getMessage());
        }
    }

    public Map<String, Object> register(String name, String email, String password, String restaurantName, String phone,
            String address,
            Double latitude, Double longitude, String businessType, String requestedPlan, String outletsCount) {
        if (name == null || name.trim().isEmpty())
            throw new BadRequestException("Name is required");
        if (email == null || email.trim().isEmpty())
            throw new BadRequestException("Email is required");
        if (restaurantName == null || restaurantName.trim().isEmpty())
            throw new BadRequestException("Restaurant Name is required");
        if (password == null || password.trim().isEmpty())
            throw new BadRequestException("Password is required");

        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email already exists");
        }

        User user = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(password))
                .restaurantName(restaurantName)
                .phone(phone)
                .address(address)
                .latitude(latitude)
                .longitude(longitude)
                .businessType(businessType)
                .requestedPlan(requestedPlan)
                .outletsCount(outletsCount)
                .tempPassword(password)
                .role(User.Role.OWNER)
                .isApproved(false)
                .build();

        User savedUser = userRepository.save(java.util.Objects.requireNonNull(user));
        String token = generateToken(savedUser);
        return buildAuthResponse(savedUser, token);

    }

    public Map<String, Object> login(String email, String password) {
        // ── Offline-First lookup ─────────────────────────────────────────────
        // Priority 1: Local database (works without internet)
        // Priority 2: Cloud database fallback (syncs user locally for future offline
        // use)
        User user = offlineFirstLoginService.findUserOfflineFirst(email)
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));

        if (!user.getIsActive())
            throw new BadRequestException("Account is deactivated");
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("Invalid email or password");
        }

        checkLicense(user);

        String token = generateToken(user);
        return buildAuthResponse(user, token);
    }

    public void checkLicense(User user) {
        boolean isStandalone = "true".equalsIgnoreCase(System.getProperty("STANDALONE"))
                || "true".equalsIgnoreCase(System.getenv("STANDALONE"));

        // Block offline/hardware-licensed users from logging in via the online
        // endpoint.
        // These accounts are bound to a physical machine license and are not valid for
        // cloud/online authentication.
        if (!isStandalone && "hardware".equalsIgnoreCase(user.getLicenseType())) {
            throw new BadRequestException("Invalid email or password");
        }

        if (!Boolean.TRUE.equals(user.getIsProBloomAdmin())) {
            if (isStandalone) {
                // In standalone mode, verify the machine-bound license.
                // If it is not there, or expired, or bound to a different machine, reject.
                if (!licenseService.isLicenseValid()) {
                    throw new BadRequestException("License expired or invalid. Please contact support.");
                }
            } else {
                // In cloud mode, verify subscription expiration
                User owner = user.getRole() == User.Role.OWNER ? user : user.getParentOwner();
                if (owner != null && owner.getSubscriptionExpiresAt() != null) {
                    if (java.time.LocalDateTime.now().isAfter(owner.getSubscriptionExpiresAt())) {
                        throw new BadRequestException("Your ProBloom license expired on "
                                + owner.getSubscriptionExpiresAt().toLocalDate()
                                + ". Please contact ProBloom support to renew your subscription.");
                    }
                }
            }
        }
    }

    public User getProfile(@NonNull Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    @NonNull
    public User updateLogo(@NonNull Long userId, String logoPath) {
        User user = getProfile(userId);
        user.setLogo("/uploads/" + logoPath);

        User savedLogo = userRepository.save(java.util.Objects.requireNonNull(user));
        return savedLogo;
    }

    public User updateProfile(@NonNull Long userId, @NonNull Map<String, Object> updates) {
        User user = getProfile(userId);
        if (updates.containsKey("name"))
            user.setName((String) updates.get("name"));
        if (updates.containsKey("restaurantName"))
            user.setRestaurantName((String) updates.get("restaurantName"));
        if (updates.containsKey("phone"))
            user.setPhone((String) updates.get("phone"));
        if (updates.containsKey("address"))
            user.setAddress((String) updates.get("address"));
        if (updates.containsKey("currency"))
            user.setCurrency((String) updates.get("currency"));
        if (updates.containsKey("gstNumber"))
            user.setGstNumber((String) updates.get("gstNumber"));
        if (updates.containsKey("cloudBackupPath"))
            user.setCloudBackupPath((String) updates.get("cloudBackupPath"));

        if (updates.containsKey("taxRate"))
            user.setTaxRate(parseOptionalDouble(updates, "taxRate", user.getTaxRate()));
        if (updates.containsKey("latitude"))
            user.setLatitude(parseOptionalDouble(updates, "latitude", user.getLatitude()));
        if (updates.containsKey("longitude"))
            user.setLongitude(parseOptionalDouble(updates, "longitude", user.getLongitude()));
        if (updates.containsKey("geofenceRadius"))
            user.setGeofenceRadius(parseOptionalDouble(updates, "geofenceRadius", user.getGeofenceRadius()));
        if (updates.containsKey("onboardingStep"))
            user.setOnboardingStep(parseOptionalInt(updates, "onboardingStep", user.getOnboardingStep()));

        if (updates.containsKey("onboardingCompleted"))
            user.setOnboardingCompleted((Boolean) updates.get("onboardingCompleted"));
        if (updates.containsKey("totalTables"))
            user.setTotalTables(parseOptionalInt(updates, "totalTables", user.getTotalTables()));

        // --- PRINTER SETTINGS ---
        if (updates.containsKey("acTables"))
            user.setAcTables((String) updates.get("acTables"));
        if (updates.containsKey("acChargePercentage")) {
            user.setAcChargePercentage(parseOptionalDouble(updates, "acChargePercentage",
                    user.getAcChargePercentage() != null ? user.getAcChargePercentage() : 20.0));
        }
        if (updates.containsKey("kitchenPrinterIp"))
            user.setKitchenPrinterIp((String) updates.get("kitchenPrinterIp"));
        if (updates.containsKey("counterPrinterIp"))
            user.setCounterPrinterIp((String) updates.get("counterPrinterIp"));
        if (updates.containsKey("billPrinterEnabled"))
            user.setBillPrinterEnabled((Boolean) updates.get("billPrinterEnabled"));
        if (updates.containsKey("kotPrinterEnabled"))
            user.setKotPrinterEnabled((Boolean) updates.get("kotPrinterEnabled"));
        if (updates.containsKey("categoryPrinterEnabled"))
            user.setCategoryPrinterEnabled((Boolean) updates.get("categoryPrinterEnabled"));
        if (updates.containsKey("autoPrintEnabled"))
            user.setAutoPrintEnabled((Boolean) updates.get("autoPrintEnabled"));
        if (updates.containsKey("consolidatedReceipt"))
            user.setConsolidatedReceipt((Boolean) updates.get("consolidatedReceipt"));
        if (updates.containsKey("reprintKOT"))
            user.setReprintKOT((Boolean) updates.get("reprintKOT"));
        if (updates.containsKey("reprintBill"))
            user.setReprintBill((Boolean) updates.get("reprintBill"));
        if (updates.containsKey("largeFontKOT"))
            user.setLargeFontKOT((Boolean) updates.get("largeFontKOT"));
        if (updates.containsKey("itemWiseKOT"))
            user.setItemWiseKOT((Boolean) updates.get("itemWiseKOT"));

        if (updates.containsKey("minPrintPrice"))
            user.setMinPrintPrice(parseOptionalDouble(updates, "minPrintPrice", user.getMinPrintPrice()));
        if (updates.containsKey("printCount"))
            user.setPrintCount(parseOptionalInt(updates, "printCount", user.getPrintCount()));
        if (updates.containsKey("basicBillTemplate"))
            user.setBasicBillTemplate((String) updates.get("basicBillTemplate"));
        if (updates.containsKey("printCategoryInBill"))
            user.setPrintCategoryInBill((Boolean) updates.get("printCategoryInBill"));

        // --- BANK DETAILS ---
        if (updates.containsKey("bankName"))
            user.setBankName((String) updates.get("bankName"));
        if (updates.containsKey("bankAccountName"))
            user.setBankAccountName((String) updates.get("bankAccountName"));
        if (updates.containsKey("bankAccountNumber"))
            user.setBankAccountNumber((String) updates.get("bankAccountNumber"));
        if (updates.containsKey("bankIfsc"))
            user.setBankIfsc((String) updates.get("bankIfsc"));

        // --- BILLING SETTINGS ---
        if (updates.containsKey("billPrefix"))
            user.setBillPrefix((String) updates.get("billPrefix"));
        if (updates.containsKey("nextBillSequence"))
            user.setNextBillSequence(parseOptionalInt(updates, "nextBillSequence", user.getNextBillSequence()));

        // --- OTHER SETTINGS ---
        if (updates.containsKey("quickMode"))
            user.setQuickMode((Boolean) updates.get("quickMode"));
        if (updates.containsKey("manualQuantity"))
            user.setManualQuantity((Boolean) updates.get("manualQuantity"));
        if (updates.containsKey("lowStockAlert"))
            user.setLowStockAlert((Boolean) updates.get("lowStockAlert"));
        if (updates.containsKey("allowNoStockSale"))
            user.setAllowNoStockSale((Boolean) updates.get("allowNoStockSale"));
        if (updates.containsKey("trackCustomerDetail"))
            user.setTrackCustomerDetail((Boolean) updates.get("trackCustomerDetail"));
        if (updates.containsKey("enableCustomerPointsPage"))
            user.setEnableCustomerPointsPage((Boolean) updates.get("enableCustomerPointsPage"));

        if (updates.containsKey("menuLayout"))
            user.setMenuLayout((String) updates.get("menuLayout"));
        if (updates.containsKey("menuColorStyle"))
            user.setMenuColorStyle((String) updates.get("menuColorStyle"));
        if (updates.containsKey("menuItemColumnCount"))
            user.setMenuItemColumnCount(
                    parseOptionalInt(updates, "menuItemColumnCount", user.getMenuItemColumnCount()));

        // --- ONLINE ORDER SETTINGS ---
        if (updates.containsKey("onlineAutoAccept"))
            user.setOnlineAutoAccept((Boolean) updates.get("onlineAutoAccept"));
        if (updates.containsKey("onlineAutoPrint"))
            user.setOnlineAutoPrint((Boolean) updates.get("onlineAutoPrint"));
        if (updates.containsKey("onlinePrintCounter"))
            user.setOnlinePrintCounter((Boolean) updates.get("onlinePrintCounter"));
        if (updates.containsKey("onlinePrintKitchen"))
            user.setOnlinePrintKitchen((Boolean) updates.get("onlinePrintKitchen"));
        if (updates.containsKey("onlineNotification"))
            user.setOnlineNotification((Boolean) updates.get("onlineNotification"));
        if (updates.containsKey("onlineStockActivateTime"))
            user.setOnlineStockActivateTime((Boolean) updates.get("onlineStockActivateTime"));
        if (updates.containsKey("customerOrderMode"))
            user.setCustomerOrderMode((Boolean) updates.get("customerOrderMode"));

        // --- WHATSAPP SETTINGS ---
        if (updates.containsKey("whatsappCountryCode"))
            user.setWhatsappCountryCode((String) updates.get("whatsappCountryCode"));
        if (updates.containsKey("whatsappDetailedBill"))
            user.setWhatsappDetailedBill((Boolean) updates.get("whatsappDetailedBill"));

        if (updates.containsKey("tableMetadata"))
            user.setTableMetadata((String) updates.get("tableMetadata"));
        if (updates.containsKey("tableCategories"))
            user.setTableCategories((String) updates.get("tableCategories"));
        if (updates.containsKey("stockCategories"))
            user.setStockCategories((String) updates.get("stockCategories"));
        if (updates.containsKey("preferredPosMode"))
            user.setPreferredPosMode((String) updates.get("preferredPosMode"));

        if (updates.containsKey("preferredLanguage"))
            user.setPreferredLanguage((String) updates.get("preferredLanguage"));
        if (updates.containsKey("printLanguage"))
            user.setPrintLanguage((String) updates.get("printLanguage"));
        if (updates.containsKey("accentColor"))
            user.setAccentColor((String) updates.get("accentColor"));

        User savedProfile = userRepository.save(java.util.Objects.requireNonNull(user));
        return savedProfile;
    }

    @NonNull
    public User completeOnboarding(@NonNull Long userId, Integer step, Map<String, Object> data) {
        User user = getProfile(userId);
        user.setOnboardingStep(step);
        if (step == 3) {
            user.setOnboardingCompleted(true);
        }

        // Apply any extra data provided
        if (data != null) {
            if (data.containsKey("restaurantName"))
                user.setRestaurantName((String) data.get("restaurantName"));
            if (data.containsKey("phone"))
                user.setPhone((String) data.get("phone"));
            if (data.containsKey("address"))
                user.setAddress((String) data.get("address"));
            if (data.containsKey("currency"))
                user.setCurrency((String) data.get("currency"));
            if (data.containsKey("gstNumber"))
                user.setGstNumber((String) data.get("gstNumber"));
            if (data.containsKey("taxRate") && data.get("taxRate") != null)
                user.setTaxRate(Double.valueOf(data.get("taxRate").toString()));
            if (data.containsKey("latitude") && data.get("latitude") != null)
                user.setLatitude(Double.valueOf(data.get("latitude").toString()));
            if (data.containsKey("longitude") && data.get("longitude") != null)
                user.setLongitude(Double.valueOf(data.get("longitude").toString()));
        }

        User savedOnboard = userRepository.save(java.util.Objects.requireNonNull(user));
        return savedOnboard;
    }

    public List<User> getStaff(@NonNull User owner) {
        return userRepository.findByParentOwnerAndIsActiveTrue(owner);
    }

    @NonNull
    public User addStaff(@NonNull User owner, String name, String email, String password, String roleStr,
            List<String> assignedTables) {
        if (userRepository.existsByEmail(email))
            throw new BadRequestException("Email already registered");
        User.Role role = User.Role.valueOf(roleStr.toUpperCase());
        User staff = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(password))
                .restaurantName(owner.getRestaurantName())
                .role(role)
                .parentOwner(owner)
                .isActive(true)
                .onboardingCompleted(true)
                .build();

        if (assignedTables != null) {
            staff.setAssignedTables(assignedTables);
        }

        User savedStaff = userRepository.save(java.util.Objects.requireNonNull(staff));
        return savedStaff;
    }

    @Transactional
    @NonNull
    public User updateStaff(@NonNull User owner, @NonNull Long staffId, @NonNull Map<String, Object> updates) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff not found"));

        if (staff.getParentOwner() == null || !staff.getParentOwner().getId().equals(owner.getId())) {
            throw new BadRequestException("Not your staff member");
        }

        if (updates.containsKey("name"))
            staff.setName((String) updates.get("name"));
        if (updates.containsKey("email")) {
            String newEmail = (String) updates.get("email");
            if (newEmail != null && !newEmail.equalsIgnoreCase(staff.getEmail())) {
                if (userRepository.existsByEmail(newEmail)) {
                    throw new BadRequestException("Email already registered by another user");
                }
                staff.setEmail(newEmail);
            }
        }
        if (updates.containsKey("role")) {
            String roleStr = updates.get("role").toString().toUpperCase();
            try {
                staff.setRole(User.Role.valueOf(roleStr));
            } catch (IllegalArgumentException e) {
                // If invalid role sent, maybe it's "STAFF" but we need "WAITER"?
                // We'll keep existing role if invalid.
            }
        }
        if (updates.containsKey("password") && updates.get("password") != null
                && !updates.get("password").toString().isEmpty()) {
            staff.setPassword(passwordEncoder.encode(updates.get("password").toString()));
        }
        if (updates.containsKey("assignedTables")) {
            @SuppressWarnings("unchecked")
            List<Object> rawTables = (List<Object>) updates.get("assignedTables");
            List<String> tables = rawTables.stream().map(Object::toString)
                    .collect(java.util.stream.Collectors.toList());
            staff.setAssignedTables(tables);
        }
        if (updates.containsKey("isActive")) {
            staff.setIsActive((Boolean) updates.get("isActive"));
        }

        User updatedStaff = userRepository.save(java.util.Objects.requireNonNull(staff));
        return updatedStaff;
    }

    public void deleteStaff(@NonNull User owner, @NonNull Long staffId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff not found"));
        if (!staff.getParentOwner().getId().equals(owner.getId())) {
            throw new BadRequestException("Not your staff member");
        }
        staff.setIsActive(false);
        userRepository.save(staff);
    }

    public Map<String, Object> firebaseLogin(String phone) {
        if (phone == null || phone.isEmpty())
            throw new BadRequestException("Phone number is required");

        User user = userRepository.findFirstByPhone(phone).orElse(null);
        if (user == null) {
            // Create new customer
            user = User.builder()
                    .name("Customer")
                    .phone(phone)
                    .email(phone + "@customer.com")
                    .password(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                    .role(User.Role.CUSTOMER)
                    .restaurantName("ProBloom")
                    .isActive(true)
                    .build();

            User savedUser = userRepository.save(java.util.Objects.requireNonNull(user));
            user = savedUser;
        }

        checkLicense(user);

        String token = generateToken(user);
        return buildAuthResponse(user, token);
    }

    private String generateToken(User user) {
        Long ownerId = user.getRole() == User.Role.OWNER ? user.getId()
                : (user.getParentOwner() != null ? user.getParentOwner().getId()
                        : (user.getRole() == User.Role.CUSTOMER ? 0L : user.getId()));
        return jwtUtil.generateToken(String.valueOf(user.getId()), user.getRole().name(), ownerId);
    }

    private Map<String, Object> buildAuthResponse(User user, String token) {
        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("user", sanitizeUser(user));
        return data;
    }

    public Map<String, Object> sanitizeUser(User user) {
        // Resolve the effective "owner" for restaurant-wide settings (metadata, tables,
        // etc.)
        User owner = (user.getRole() == User.Role.OWNER) ? user : user.getParentOwner();

        Map<String, Object> u = new HashMap<>();
        u.put("id", user.getId());
        u.put("_id", user.getId());
        u.put("name", user.getName());
        u.put("email", user.getEmail());
        u.put("restaurantName", user.getRestaurantName());
        u.put("phone", user.getPhone());
        u.put("address", owner != null ? owner.getAddress() : user.getAddress());
        u.put("latitude", owner != null ? owner.getLatitude() : user.getLatitude());
        u.put("longitude", owner != null ? owner.getLongitude() : user.getLongitude());
        u.put("geofenceRadius", owner != null ? owner.getGeofenceRadius() : user.getGeofenceRadius());
        u.put("logo", owner != null ? owner.getLogo() : user.getLogo());
        u.put("role", user.getRole().name().toLowerCase());
        u.put("currency", owner != null ? owner.getCurrency() : user.getCurrency());
        u.put("gstNumber", owner != null ? owner.getGstNumber() : user.getGstNumber());
        u.put("taxRate", owner != null ? owner.getTaxRate() : user.getTaxRate());
        u.put("cloudBackupPath", owner != null ? owner.getCloudBackupPath() : user.getCloudBackupPath());
        u.put("subscriptionPlan", owner != null ? owner.getSubscriptionPlan().name().toLowerCase()
                : user.getSubscriptionPlan().name().toLowerCase());
        u.put("subscriptionActive", owner != null ? owner.getSubscriptionActive() : user.getSubscriptionActive());
        u.put("subscriptionExpiresAt",
                owner != null ? owner.getSubscriptionExpiresAt() : user.getSubscriptionExpiresAt());
        u.put("isProBloomAdmin", user.getIsProBloomAdmin());
        u.put("isApproved", user.getIsApproved());
        u.put("businessType", user.getBusinessType());
        u.put("requestedPlan", user.getRequestedPlan());
        u.put("outletsCount", user.getOutletsCount());
        u.put("tempPassword", user.getTempPassword());

        java.time.LocalDateTime expiresAt = owner != null ? owner.getSubscriptionExpiresAt()
                : user.getSubscriptionExpiresAt();
        if (expiresAt != null) {
            u.put("_licenseExpiresAt", expiresAt);
            long daysLeft = java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDateTime.now(), expiresAt);
            u.put("_licenseDaysLeft", daysLeft);
        }

        u.put("onboardingCompleted", owner != null ? owner.getOnboardingCompleted() : user.getOnboardingCompleted());
        u.put("onboardingStep", owner != null ? owner.getOnboardingStep() : user.getOnboardingStep());
        u.put("totalTables", owner != null ? owner.getTotalTables() : user.getTotalTables());
        u.put("assignedTables", user.getAssignedTables());
        u.put("acTables", owner != null ? owner.getAcTables() : user.getAcTables());
        u.put("acChargePercentage", owner != null ? owner.getAcChargePercentage() : user.getAcChargePercentage());

        // --- PRINTER SETTINGS ---
        u.put("kitchenPrinterIp", owner != null ? owner.getKitchenPrinterIp() : user.getKitchenPrinterIp());
        u.put("counterPrinterIp", owner != null ? owner.getCounterPrinterIp() : user.getCounterPrinterIp());
        u.put("billPrinterEnabled", owner != null ? owner.getBillPrinterEnabled() : user.getBillPrinterEnabled());
        u.put("kotPrinterEnabled", owner != null ? owner.getKotPrinterEnabled() : user.getKotPrinterEnabled());
        u.put("categoryPrinterEnabled",
                owner != null ? owner.getCategoryPrinterEnabled() : user.getCategoryPrinterEnabled());
        u.put("autoPrintEnabled", owner != null ? owner.getAutoPrintEnabled() : user.getAutoPrintEnabled());
        u.put("minPrintPrice", owner != null ? owner.getMinPrintPrice() : user.getMinPrintPrice());
        u.put("consolidatedReceipt", owner != null ? owner.getConsolidatedReceipt() : user.getConsolidatedReceipt());
        u.put("reprintKOT", owner != null ? owner.getReprintKOT() : user.getReprintKOT());
        u.put("reprintBill", owner != null ? owner.getReprintBill() : user.getReprintBill());
        u.put("largeFontKOT", owner != null ? owner.getLargeFontKOT() : user.getLargeFontKOT());
        u.put("itemWiseKOT", owner != null ? owner.getItemWiseKOT() : user.getItemWiseKOT());
        u.put("printCount", owner != null ? owner.getPrintCount() : user.getPrintCount());
        u.put("basicBillTemplate", owner != null ? owner.getBasicBillTemplate() : user.getBasicBillTemplate());
        u.put("printCategoryInBill", owner != null ? owner.getPrintCategoryInBill() : user.getPrintCategoryInBill());

        u.put("bankName", owner != null ? owner.getBankName() : user.getBankName());
        u.put("bankAccountName", owner != null ? owner.getBankAccountName() : user.getBankAccountName());
        u.put("bankAccountNumber", owner != null ? owner.getBankAccountNumber() : user.getBankAccountNumber());
        u.put("bankIfsc", owner != null ? owner.getBankIfsc() : user.getBankIfsc());

        // --- OTHER SETTINGS ---
        u.put("quickMode", owner != null ? owner.getQuickMode() : user.getQuickMode());
        u.put("manualQuantity", owner != null ? owner.getManualQuantity() : user.getManualQuantity());
        u.put("menuLayout", owner != null ? owner.getMenuLayout() : user.getMenuLayout());
        u.put("menuColorStyle", owner != null ? owner.getMenuColorStyle() : user.getMenuColorStyle());
        u.put("menuItemColumnCount", owner != null ? owner.getMenuItemColumnCount() : user.getMenuItemColumnCount());
        u.put("lowStockAlert", owner != null ? owner.getLowStockAlert() : user.getLowStockAlert());
        u.put("allowNoStockSale", owner != null ? owner.getAllowNoStockSale() : user.getAllowNoStockSale());
        u.put("trackCustomerDetail", owner != null ? owner.getTrackCustomerDetail() : user.getTrackCustomerDetail());
        u.put("enableCustomerPointsPage",
                owner != null ? owner.getEnableCustomerPointsPage() : user.getEnableCustomerPointsPage());

        // --- ONLINE ORDER SETTINGS ---
        u.put("onlineAutoAccept", owner != null ? owner.getOnlineAutoAccept() : user.getOnlineAutoAccept());
        u.put("onlineAutoPrint", owner != null ? owner.getOnlineAutoPrint() : user.getOnlineAutoPrint());
        u.put("onlinePrintCounter", owner != null ? owner.getOnlinePrintCounter() : user.getOnlinePrintCounter());
        u.put("onlinePrintKitchen", owner != null ? owner.getOnlinePrintKitchen() : user.getOnlinePrintKitchen());
        u.put("onlineNotification", owner != null ? owner.getOnlineNotification() : user.getOnlineNotification());
        u.put("onlineStockActivateTime",
                owner != null ? owner.getOnlineStockActivateTime() : user.getOnlineStockActivateTime());
        u.put("customerOrderMode", owner != null ? owner.getCustomerOrderMode() : user.getCustomerOrderMode());

        // --- WHATSAPP SETTINGS ---
        u.put("whatsappCountryCode", owner != null ? owner.getWhatsappCountryCode() : user.getWhatsappCountryCode());
        u.put("whatsappDetailedBill", owner != null ? owner.getWhatsappDetailedBill() : user.getWhatsappDetailedBill());
        u.put("tableMetadata", owner != null ? owner.getTableMetadata() : user.getTableMetadata());
        u.put("tableCategories", owner != null ? owner.getTableCategories() : user.getTableCategories());
        u.put("stockCategories", owner != null ? owner.getStockCategories() : user.getStockCategories());
        u.put("preferredLanguage", user.getPreferredLanguage());
        u.put("printLanguage", user.getPrintLanguage());
        u.put("accentColor", owner != null ? owner.getAccentColor() : user.getAccentColor());
        u.put("preferredPosMode", owner != null ? owner.getPreferredPosMode() : user.getPreferredPosMode());
        u.put("parentOwnerId", user.getParentOwner() != null ? user.getParentOwner().getId() : null);
        u.put("createdAt", user.getCreatedAt());
        return u;
    }

    private Double parseOptionalDouble(Map<String, Object> data, String key, Double defaultValue) {
        if (!data.containsKey(key) || data.get(key) == null || data.get(key).toString().isEmpty())
            return defaultValue;
        try {
            return Double.valueOf(data.get(key).toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private Integer parseOptionalInt(Map<String, Object> data, String key, Integer defaultValue) {
        if (!data.containsKey(key) || data.get(key) == null || data.get(key).toString().isEmpty())
            return defaultValue;
        try {
            return Integer.valueOf(data.get(key).toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
