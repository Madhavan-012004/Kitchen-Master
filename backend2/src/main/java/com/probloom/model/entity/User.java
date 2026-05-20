package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "restaurant_name", nullable = false)
    private String restaurantName;

    @Column
    private String phone;

    @Column
    private String address;

    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(name = "geofence_radius")
    private Double geofenceRadius = 500.0;

    @Column(name = "total_tables")
    private Integer totalTables = 10;

    @Column
    private String logo;

    @Column
    private String currency = "INR";

    @Column(name = "tax_rate")
    private Double taxRate = 5.0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.OWNER;

    @Column(name = "gst_number")
    private String gstNumber;

    @Column(name = "dl_number")
    private String dlNumber;

    @Column(name = "tin_number")
    private String tinNumber;

    @Column(name = "cin_number")
    private String cinNumber;

    @Column(name = "kitchen_printer_ip")
    private String kitchenPrinterIp;

    @Column(name = "counter_printer_ip")
    private String counterPrinterIp;

    @Column(name = "ac_tables")
    private String acTables;

    @Column(name = "ac_charge_percentage")
    private Double acChargePercentage = 20.0;

    @Column(name = "table_metadata", columnDefinition = "TEXT")
    private String tableMetadata;

    @Column(name = "table_categories", columnDefinition = "TEXT")
    private String tableCategories;

    // --- PRINTER SETTINGS ---
    @Column(name = "bill_printer_enabled")
    private Boolean billPrinterEnabled = true;

    @Column(name = "kot_printer_enabled")
    private Boolean kotPrinterEnabled = true;

    @Column(name = "category_printer_enabled")
    private Boolean category_printer_enabled = false;

    @Column(name = "auto_print_enabled")
    private Boolean autoPrintEnabled = false;

    @Column(name = "min_print_price")
    private Double minPrintPrice = 0.0;

    @Column(name = "consolidated_receipt")
    private Boolean consolidatedReceipt = false;

    @Column(name = "reprint_kot")
    private Boolean reprintKOT = false;

    @Column(name = "reprint_bill")
    private Boolean reprintBill = false;

    @Column(name = "large_font_kot")
    private Boolean largeFontKOT = false;

    @Column(name = "item_wise_kot")
    private Boolean itemWiseKOT = false;

    @Column(name = "print_count")
    private Integer printCount = 1;

    @Column(name = "pharmacy_font_size")
    private Integer pharmacyFontSize = 11;

    @Column(name = "basic_bill_template")
    private String basicBillTemplate = "standard";

    @Column(name = "print_category_in_bill")
    private Boolean printCategoryInBill = false;

    // --- BANK DETAILS ---
    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "bank_account_name")
    private String bankAccountName;

    @Column(name = "bank_account_number")
    private String bankAccountNumber;

    @Column(name = "bank_ifsc")
    private String bankIfsc;

    // --- OTHER SETTINGS ---
    @Column(name = "quick_mode")
    private Boolean quickMode = false;

    @Column(name = "manual_quantity")
    private Boolean manualQuantity = false;

    @Column(name = "menu_layout")
    private String menuLayout = "Side Menu";

    @Column(name = "menu_color_style")
    private String menuColorStyle = "MultiColor";

    @Column(name = "menu_item_column_count")
    private Integer menuItemColumnCount = 5;

    @Column(name = "low_stock_alert")
    private Boolean lowStockAlert = true;

    @Column(name = "allow_no_stock_sale")
    private Boolean allowNoStockSale = true;

    @Column(name = "track_customer_detail")
    private Boolean trackCustomerDetail = true;

    // --- ONLINE ORDER SETTINGS ---
    @Column(name = "online_auto_accept")
    private Boolean onlineAutoAccept = false;

    @Column(name = "online_auto_print")
    private Boolean onlineAutoPrint = false;

    @Column(name = "online_print_counter")
    private Boolean onlinePrintCounter = true;

    @Column(name = "online_print_kitchen")
    private Boolean onlinePrintKitchen = true;

    @Column(name = "online_notification")
    private Boolean onlineNotification = true;

    @Column(name = "online_stock_activate_time")
    private Boolean onlineStockActivateTime = false;

    // --- WHATSAPP SETTINGS ---
    @Column(name = "whatsapp_country_code")
    private String whatsappCountryCode = "+91";

    @Column(name = "whatsapp_detailed_bill")
    private Boolean whatsappDetailedBill = false;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_owner_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User parentOwner;

    @ElementCollection
    @CollectionTable(name = "user_assigned_tables", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "table_number")
    private List<String> assignedTables;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_plan")
    private SubscriptionPlan subscriptionPlan = SubscriptionPlan.FREE;

    @Column(name = "subscription_started_at")
    private LocalDateTime subscriptionStartedAt;

    @Column(name = "subscription_expires_at")
    private LocalDateTime subscriptionExpiresAt;

    @Column(name = "subscription_active")
    private Boolean subscriptionActive = true;

    @Column(name = "onboarding_completed")
    private Boolean onboardingCompleted = false;

    @Column(name = "onboarding_step")
    private Integer onboardingStep = 1;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "is_approved")
    private Boolean isApproved = true;

    @Column(name = "business_type")
    private String businessType;

    @Column(name = "requested_plan")
    private String requestedPlan;

    @Column(name = "outlets_count")
    private String outletsCount;

    @Column(name = "temp_password", nullable = true)
    private String tempPassword;

    @Column(name = "otp")
    private String otp;

    @Column(name = "otp_expires_at")
    private LocalDateTime otpExpiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "is_probloom_admin")
    private Boolean isProBloomAdmin = false;

    @Column(name = "license_type")
    private String licenseType = "digital";

    @Column(name = "license_key", columnDefinition = "TEXT")
    private String licenseKey;

    @Column(name = "preferred_pos_mode")
    private String preferredPosMode = "restaurant";

    @Column(name = "preferred_language")
    private String preferredLanguage = "en";

    @Column(name = "print_language")
    private String printLanguage = "en";

    @Column(name = "accent_color")
    private String accentColor = "#C6F53D";

    @Column(name = "stock_categories", columnDefinition = "TEXT")
    private String stockCategories = "General,Grocery,Clothing,Pharmacy,Others";

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getGeofenceRadius() { return geofenceRadius; }
    public void setGeofenceRadius(Double geofenceRadius) { this.geofenceRadius = geofenceRadius; }
    public String getLogo() { return logo; }
    public void setLogo(String logo) { this.logo = logo; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Double getTaxRate() { return taxRate; }
    public void setTaxRate(Double taxRate) { this.taxRate = taxRate; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public User getParentOwner() { return parentOwner; }
    public void setParentOwner(User parentOwner) { this.parentOwner = parentOwner; }
    public List<String> getAssignedTables() { return assignedTables; }
    public void setAssignedTables(List<String> assignedTables) { this.assignedTables = assignedTables; }
    public SubscriptionPlan getSubscriptionPlan() { return subscriptionPlan; }
    public void setSubscriptionPlan(SubscriptionPlan subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; }
    public LocalDateTime getSubscriptionStartedAt() { return subscriptionStartedAt; }
    public void setSubscriptionStartedAt(LocalDateTime subscriptionStartedAt) { this.subscriptionStartedAt = subscriptionStartedAt; }
    public LocalDateTime getSubscriptionExpiresAt() { return subscriptionExpiresAt; }
    public void setSubscriptionExpiresAt(LocalDateTime subscriptionExpiresAt) { this.subscriptionExpiresAt = subscriptionExpiresAt; }
    public Boolean getSubscriptionActive() { return subscriptionActive; }
    public void setSubscriptionActive(Boolean subscriptionActive) { this.subscriptionActive = subscriptionActive; }

    public Boolean getIsProBloomAdmin() { return isProBloomAdmin; }
    public void setIsProBloomAdmin(Boolean isProBloomAdmin) { this.isProBloomAdmin = isProBloomAdmin; }
    
    public String getLicenseType() { return licenseType; }
    public void setLicenseType(String licenseType) { this.licenseType = licenseType; }

    public String getLicenseKey() { return licenseKey; }
    public void setLicenseKey(String licenseKey) { this.licenseKey = licenseKey; }

    public String getPreferredPosMode() { return preferredPosMode; }
    public void setPreferredPosMode(String preferredPosMode) { this.preferredPosMode = preferredPosMode; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public String getPrintLanguage() { return printLanguage; }
    public void setPrintLanguage(String printLanguage) { this.printLanguage = printLanguage; }

    public String getAccentColor() { return accentColor; }
    public void setAccentColor(String accentColor) { this.accentColor = accentColor; }

    public Boolean getOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(Boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }
    public Integer getOnboardingStep() { return onboardingStep; }
    public void setOnboardingStep(Integer onboardingStep) { this.onboardingStep = onboardingStep; }
    public Integer getTotalTables() { return totalTables; }
    public void setTotalTables(Integer totalTables) { this.totalTables = totalTables; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public Boolean getIsApproved() { return isApproved; }
    public void setIsApproved(Boolean isApproved) { this.isApproved = isApproved; }

    public String getBusinessType() { return businessType; }
    public void setBusinessType(String s) { this.businessType = s; }

    public String getRequestedPlan() { return requestedPlan; }
    public void setRequestedPlan(String s) { this.requestedPlan = s; }

    public String getOutletsCount() { return outletsCount; }
    public void setOutletsCount(String s) { this.outletsCount = s; }

    public String getTempPassword() { return tempPassword; }
    public void setTempPassword(String s) { this.tempPassword = s; }

    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }
    public LocalDateTime getOtpExpiresAt() { return otpExpiresAt; }
    public void setOtpExpiresAt(LocalDateTime otpExpiresAt) { this.otpExpiresAt = otpExpiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getGstNumber() { return gstNumber; }
    public void setGstNumber(String gstNumber) { this.gstNumber = gstNumber; }

    public String getKitchenPrinterIp() { return kitchenPrinterIp; }
    public void setKitchenPrinterIp(String ip) { this.kitchenPrinterIp = ip; }
    
    public String getCounterPrinterIp() { return counterPrinterIp; }
    public void setCounterPrinterIp(String ip) { this.counterPrinterIp = ip; }

    public String getAcTables() { return acTables; }
    public void setAcTables(String acTables) { this.acTables = acTables; }
    public Double getAcChargePercentage() { return acChargePercentage; }
    public void setAcChargePercentage(Double acChargePercentage) { this.acChargePercentage = acChargePercentage; }

    public String getTableMetadata() { return tableMetadata; }
    public void setTableMetadata(String tableMetadata) { this.tableMetadata = tableMetadata; }

    public String getTableCategories() { return tableCategories; }
    public void setTableCategories(String tableCategories) { this.tableCategories = tableCategories; }

    // Printer Setters/Getters
    public Boolean getBillPrinterEnabled() { return billPrinterEnabled; }
    public void setBillPrinterEnabled(Boolean b) { this.billPrinterEnabled = b; }
    public Boolean getKotPrinterEnabled() { return kotPrinterEnabled; }
    public void setKotPrinterEnabled(Boolean b) { this.kotPrinterEnabled = b; }
    public Boolean getCategoryPrinterEnabled() { return category_printer_enabled; }
    public void setCategoryPrinterEnabled(Boolean b) { this.category_printer_enabled = b; }
    public Boolean getAutoPrintEnabled() { return autoPrintEnabled; }
    public void setAutoPrintEnabled(Boolean b) { this.autoPrintEnabled = b; }
    public Double getMinPrintPrice() { return minPrintPrice; }
    public void setMinPrintPrice(Double d) { this.minPrintPrice = d; }
    public Boolean getConsolidatedReceipt() { return consolidatedReceipt; }
    public void setConsolidatedReceipt(Boolean b) { this.consolidatedReceipt = b; }
    public Boolean getReprintKOT() { return reprintKOT; }
    public void setReprintKOT(Boolean b) { this.reprintKOT = b; }
    public Boolean getReprintBill() { return reprintBill; }
    public void setReprintBill(Boolean b) { this.reprintBill = b; }
    public Boolean getLargeFontKOT() { return largeFontKOT; }
    public void setLargeFontKOT(Boolean b) { this.largeFontKOT = b; }
    public Boolean getItemWiseKOT() { return itemWiseKOT; }
    public void setItemWiseKOT(Boolean b) { this.itemWiseKOT = b; }
    public Integer getPrintCount() { return printCount; }
    public void setPrintCount(Integer i) { this.printCount = i; }
    public Integer getPharmacyFontSize() { return pharmacyFontSize; }
    public void setPharmacyFontSize(Integer i) { this.pharmacyFontSize = i; }
    
    public String getBasicBillTemplate() { return basicBillTemplate; }
    public void setBasicBillTemplate(String template) { this.basicBillTemplate = template; }

    public Boolean getPrintCategoryInBill() { return printCategoryInBill; }
    public void setPrintCategoryInBill(Boolean b) { this.printCategoryInBill = b; }

    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }

    public String getBankAccountName() { return bankAccountName; }
    public void setBankAccountName(String bankAccountName) { this.bankAccountName = bankAccountName; }

    public String getBankAccountNumber() { return bankAccountNumber; }
    public void setBankAccountNumber(String bankAccountNumber) { this.bankAccountNumber = bankAccountNumber; }

    public String getBankIfsc() { return bankIfsc; }
    public void setBankIfsc(String bankIfsc) { this.bankIfsc = bankIfsc; }

    // Other Settings Setters/Getters
    public Boolean getQuickMode() { return quickMode; }
    public void setQuickMode(Boolean b) { this.quickMode = b; }
    public Boolean getManualQuantity() { return manualQuantity; }
    public void setManualQuantity(Boolean b) { this.manualQuantity = b; }
    public String getMenuLayout() { return menuLayout; }
    public void setMenuLayout(String s) { this.menuLayout = s; }
    public String getMenuColorStyle() { return menuColorStyle; }
    public void setMenuColorStyle(String s) { this.menuColorStyle = s; }
    public Integer getMenuItemColumnCount() { return menuItemColumnCount; }
    public void setMenuItemColumnCount(Integer i) { this.menuItemColumnCount = i; }
    public Boolean getLowStockAlert() { return lowStockAlert; }
    public void setLowStockAlert(Boolean b) { this.lowStockAlert = b; }
    public Boolean getAllowNoStockSale() { return allowNoStockSale; }
    public void setAllowNoStockSale(Boolean b) { this.allowNoStockSale = b; }
    public Boolean getTrackCustomerDetail() { return trackCustomerDetail; }
    public void setTrackCustomerDetail(Boolean b) { this.trackCustomerDetail = b; }

    public String getStockCategories() { return stockCategories; }
    public void setStockCategories(String c) { this.stockCategories = c; }

    // Online Order Getters/Setters
    public Boolean getOnlineAutoAccept() { return onlineAutoAccept; }
    public void setOnlineAutoAccept(Boolean b) { this.onlineAutoAccept = b; }
    public Boolean getOnlineAutoPrint() { return onlineAutoPrint; }
    public void setOnlineAutoPrint(Boolean b) { this.onlineAutoPrint = b; }
    public Boolean getOnlinePrintCounter() { return onlinePrintCounter; }
    public void setOnlinePrintCounter(Boolean b) { this.onlinePrintCounter = b; }
    public Boolean getOnlinePrintKitchen() { return onlinePrintKitchen; }
    public void setOnlinePrintKitchen(Boolean b) { this.onlinePrintKitchen = b; }
    public Boolean getOnlineNotification() { return onlineNotification; }
    public void setOnlineNotification(Boolean b) { this.onlineNotification = b; }
    public Boolean getOnlineStockActivateTime() { return onlineStockActivateTime; }
    public void setOnlineStockActivateTime(Boolean b) { this.onlineStockActivateTime = b; }

    // WhatsApp Getters/Setters
    public String getWhatsappCountryCode() { return whatsappCountryCode; }
    public void setWhatsappCountryCode(String s) { this.whatsappCountryCode = s; }
    public Boolean getWhatsappDetailedBill() { return whatsappDetailedBill; }
    public void setWhatsappDetailedBill(Boolean b) { this.whatsappDetailedBill = b; }

    public enum Role { OWNER, MANAGER, WAITER, KOT, INVENTORY, CUSTOMER, STAKEHOLDER }
    public enum SubscriptionPlan { FREE, PRO, ENTERPRISE }

    @PrePersist
    public void prePersist() {
        if (subscriptionStartedAt == null) subscriptionStartedAt = LocalDateTime.now();
        if (subscriptionExpiresAt == null) subscriptionExpiresAt = LocalDateTime.now().plusDays(30);
    }

    public static UserBuilder builder() { return new UserBuilder(); }
    public static class UserBuilder {
        private User u = new User();
        public UserBuilder name(String n) { u.setName(n); return this; }
        public UserBuilder email(String e) { u.setEmail(e); return this; }
        public UserBuilder password(String p) { u.setPassword(p); return this; }
        public UserBuilder restaurantName(String rn) { u.setRestaurantName(rn); return this; }
        public UserBuilder phone(String p) { u.setPhone(p); return this; }
        public UserBuilder role(Role r) { u.setRole(r); return this; }
        public UserBuilder isActive(Boolean i) { u.setIsActive(i); return this; }
        public UserBuilder isApproved(Boolean a) { u.setIsApproved(a); return this; }
        public User build() { return u; }
        public UserBuilder address(String a) { u.setAddress(a); return this; }
        public UserBuilder latitude(Double l) { u.setLatitude(l); return this; }
        public UserBuilder longitude(Double l) { u.setLongitude(l); return this; }
        public UserBuilder geofenceRadius(Double r) { u.setGeofenceRadius(r); return this; }
        public UserBuilder logo(String l) { u.setLogo(l); return this; }
        public UserBuilder currency(String c) { u.setCurrency(c); return this; }
        public UserBuilder taxRate(Double t) { u.setTaxRate(t); return this; }
        public UserBuilder subscriptionPlan(SubscriptionPlan p) { u.setSubscriptionPlan(p); return this; }
        public UserBuilder onboardingCompleted(Boolean b) { u.setOnboardingCompleted(b); return this; }
        public UserBuilder onboardingStep(Integer s) { u.setOnboardingStep(s); return this; }
        public UserBuilder totalTables(Integer t) { u.setTotalTables(t); return this; }
        public UserBuilder parentOwner(User p) { u.setParentOwner(p); return this; }
        public UserBuilder otp(String o) { u.setOtp(o); return this; }
        public UserBuilder otpExpiresAt(LocalDateTime e) { u.setOtpExpiresAt(e); return this; }
        public UserBuilder gstNumber(String g) { u.setGstNumber(g); return this; }
        public UserBuilder kitchenPrinterIp(String k) { u.setKitchenPrinterIp(k); return this; }
        public UserBuilder counterPrinterIp(String c) { u.setCounterPrinterIp(c); return this; }
        public UserBuilder acTables(String a) { u.setAcTables(a); return this; }
        public UserBuilder acChargePercentage(Double a) { u.setAcChargePercentage(a); return this; }
        public UserBuilder tableMetadata(String t) { u.setTableMetadata(t); return this; }
        public UserBuilder tableCategories(String c) { u.setTableCategories(c); return this; }
        public UserBuilder isProBloomAdmin(Boolean b) { u.setIsProBloomAdmin(b); return this; }
        public UserBuilder licenseType(String t) { u.setLicenseType(t); return this; }
        public UserBuilder licenseKey(String k) { u.setLicenseKey(k); return this; }
        public UserBuilder businessType(String b) { u.setBusinessType(b); return this; }
        public UserBuilder requestedPlan(String p) { u.setRequestedPlan(p); return this; }
        public UserBuilder outletsCount(String o) { u.setOutletsCount(o); return this; }
        public UserBuilder tempPassword(String p) { u.setTempPassword(p); return this; }
        public UserBuilder preferredPosMode(String m) { u.setPreferredPosMode(m); return this; }
        public UserBuilder printCategoryInBill(Boolean b) { u.setPrintCategoryInBill(b); return this; }
        public UserBuilder preferredLanguage(String l) { u.setPreferredLanguage(l); return this; }
        public UserBuilder printLanguage(String l) { u.setPrintLanguage(l); return this; }
        public UserBuilder accentColor(String a) { u.setAccentColor(a); return this; }
        public UserBuilder stockCategories(String c) { u.setStockCategories(c); return this; }
    }
}
