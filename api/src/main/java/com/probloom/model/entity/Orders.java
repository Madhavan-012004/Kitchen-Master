package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.*;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders",
    indexes = {
        @Index(name = "idx_order_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_order_status", columnList = "restaurant_id,status"),
        @Index(name = "idx_order_payment_status", columnList = "restaurant_id,payment_status"),
        @Index(name = "idx_order_created", columnList = "restaurant_id,created_at")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_restaurant_order_number", columnNames = {"restaurant_id", "order_number"})
    }
)
public class Orders {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(name = "order_number", nullable = false)
    private String orderNumber;

    @Column(name = "table_number")
    private String tableNumber = "Takeaway";

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<OrderItem> items = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "order_extra_charges", joinColumns = @JoinColumn(name = "order_id"))
    private List<ExtraCharge> extraCharges = new ArrayList<>();

    @Column(nullable = false)
    private Double subtotal;

    @Column(name = "tax_amount")
    private Double taxAmount = 0.0;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type")
    private DiscountType discountType = DiscountType.NONE;

    @Column(name = "discount_value")
    private Double discountValue = 0.0;

    @Column(name = "discount_amount")
    private Double discountAmount = 0.0;

    @Column(name = "points_redeemed")
    private Double pointsRedeemed = 0.0;

    @Column(nullable = false)
    private Double total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod = PaymentMethod.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "customer_phone")
    private String customerPhone;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @JsonIgnore
    private User createdBy;

    @Column(name = "waiter_name")
    private String waiterName;

    @Column(name = "is_offline")
    private Boolean isOffline = false;

    @Column(name = "offline_id")
    private String offlineId;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;

    @Column(name = "kot_printed_at")
    private LocalDateTime kotPrintedAt;

    @Column(name = "bill_requested")
    private Boolean billRequested = false;

    @Column(name = "bill_printed")
    private Boolean billPrinted = false;

    @Column(name = "bill_requested_at")
    private LocalDateTime billRequestedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type")
    private OrderType orderType = OrderType.DINE_IN;

    @Column(name = "token_number")
    private String tokenNumber;

    @Column(name = "merged_tables")
    private String mergedTables;

    @Column(name = "covers")
    private Integer covers;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "bill_template")
    private String billTemplate = "standard";

    @Column(name = "doctor_name")
    private String doctorName;

    @Column(name = "number_of_days")
    private String numberOfDays;

    @Column(name = "customer_firm")
    private String customerFirm;

    @Column(name = "print_with_gst")
    private Boolean printWithGst = true;

    // Waiter Acknowledgement: true = customer order is pending waiter approval before KOT
    @Column(name = "waiting_waiter_ack")
    private Boolean waitingWaiterAck = false;

    // --- CUSTOMER FEEDBACK ---
    @Column(name = "rating")
    private Integer rating;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public String getTableNumber() { return tableNumber; }
    public void setTableNumber(String tableNumber) { this.tableNumber = tableNumber; }
    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }
    public List<ExtraCharge> getExtraCharges() { return extraCharges; }
    public void setExtraCharges(List<ExtraCharge> extraCharges) { this.extraCharges = extraCharges; }
    public Double getSubtotal() { return subtotal; }
    public void setSubtotal(Double subtotal) { this.subtotal = subtotal; }
    public Double getTaxAmount() { return taxAmount; }
    public void setTaxAmount(Double taxAmount) { this.taxAmount = taxAmount; }
    public DiscountType getDiscountType() { return discountType; }
    public void setDiscountType(DiscountType discountType) { this.discountType = discountType; }
    public Double getDiscountValue() { return discountValue; }
    public void setDiscountValue(Double discountValue) { this.discountValue = discountValue; }
    public Double getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(Double discountAmount) { this.discountAmount = discountAmount; }
    public Double getPointsRedeemed() { return pointsRedeemed; }
    public void setPointsRedeemed(Double pointsRedeemed) { this.pointsRedeemed = pointsRedeemed; }
    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public PaymentMethod getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(PaymentMethod paymentMethod) { this.paymentMethod = paymentMethod; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public String getWaiterName() { return waiterName; }
    public void setWaiterName(String waiterName) { this.waiterName = waiterName; }
    public Boolean getIsOffline() { return isOffline; }
    public void setIsOffline(Boolean isOffline) { this.isOffline = isOffline; }
    public String getOfflineId() { return offlineId; }
    public void setOfflineId(String offlineId) { this.offlineId = offlineId; }
    public LocalDateTime getSyncedAt() { return syncedAt; }
    public void setSyncedAt(LocalDateTime syncedAt) { this.syncedAt = syncedAt; }
    public LocalDateTime getKotPrintedAt() { return kotPrintedAt; }
    public void setKotPrintedAt(LocalDateTime kotPrintedAt) { this.kotPrintedAt = kotPrintedAt; }
    public Boolean getBillRequested() { return billRequested; }
    public void setBillRequested(Boolean billRequested) { this.billRequested = billRequested; }
    public Boolean getBillPrinted() { return billPrinted; }
    public void setBillPrinted(Boolean billPrinted) { this.billPrinted = billPrinted; }
    public LocalDateTime getBillRequestedAt() { return billRequestedAt; }
    public void setBillRequestedAt(LocalDateTime billRequestedAt) { this.billRequestedAt = billRequestedAt; }
    public OrderType getOrderType() { return orderType; }
    public void setOrderType(OrderType orderType) { this.orderType = orderType; }
    public String getTokenNumber() { return tokenNumber; }
    public void setTokenNumber(String tokenNumber) { this.tokenNumber = tokenNumber; }
    public String getMergedTables() { return mergedTables; }
    public void setMergedTables(String mergedTables) { this.mergedTables = mergedTables; }
    public Integer getCovers() { return covers; }
    public void setCovers(Integer covers) { this.covers = covers; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getBillTemplate() { return billTemplate; }
    public void setBillTemplate(String billTemplate) { this.billTemplate = billTemplate; }
    public String getDoctorName() { return doctorName; }
    public void setDoctorName(String doctorName) { this.doctorName = doctorName; }
    public String getNumberOfDays() { return numberOfDays; }
    public void setNumberOfDays(String numberOfDays) { this.numberOfDays = numberOfDays; }
    public String getCustomerFirm() { return customerFirm; }
    public void setCustomerFirm(String customerFirm) { this.customerFirm = customerFirm; }

    public Boolean getPrintWithGst() { return printWithGst; }
    public void setPrintWithGst(Boolean printWithGst) { this.printWithGst = printWithGst; }

    public Boolean getWaitingWaiterAck() { return waitingWaiterAck; }
    public void setWaitingWaiterAck(Boolean waitingWaiterAck) { this.waitingWaiterAck = waitingWaiterAck; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public enum OrderStatus { PENDING, PREPARING, READY, SERVED, PAID, CANCELLED }
    public enum PaymentMethod { CASH, CARD, UPI, PENDING }
    public enum PaymentStatus { UNPAID, PAID, PARTIAL }
    public enum DiscountType { PERCENTAGE, FLAT, NONE }
    public enum OrderType { DINE_IN, TAKEAWAY }

    public static OrdersBuilder builder() { return new OrdersBuilder(); }
    public static class OrdersBuilder {
        private Orders o = new Orders();
        public OrdersBuilder restaurant(User r) { o.setRestaurant(r); return this; }
        public OrdersBuilder orderNumber(String n) { o.setOrderNumber(n); return this; }
        public OrdersBuilder tableNumber(String t) { o.setTableNumber(t); return this; }
        public OrdersBuilder subtotal(Double s) { o.setSubtotal(s); return this; }
        public OrdersBuilder taxAmount(Double t) { o.setTaxAmount(t); return this; }
        public OrdersBuilder discountType(DiscountType d) { o.setDiscountType(d); return this; }
        public OrdersBuilder discountValue(Double v) { o.setDiscountValue(v); return this; }
        public OrdersBuilder discountAmount(Double a) { o.setDiscountAmount(a); return this; }
        public OrdersBuilder pointsRedeemed(Double p) { o.setPointsRedeemed(p); return this; }
        public OrdersBuilder total(Double t) { o.setTotal(t); return this; }
        public OrdersBuilder status(OrderStatus s) { o.setStatus(s); return this; }
        public OrdersBuilder paymentMethod(PaymentMethod m) { o.setPaymentMethod(m); return this; }
        public OrdersBuilder paymentStatus(PaymentStatus s) { o.setPaymentStatus(s); return this; }
        public OrdersBuilder customerName(String n) { o.setCustomerName(n); return this; }
        public OrdersBuilder customerPhone(String p) { o.setCustomerPhone(p); return this; }
        public OrdersBuilder notes(String n) { o.setNotes(n); return this; }
        public OrdersBuilder createdBy(User u) { o.setCreatedBy(u); return this; }
        public OrdersBuilder waiterName(String n) { o.setWaiterName(n); return this; }
        public OrdersBuilder isOffline(Boolean i) { o.setIsOffline(i); return this; }
        public OrdersBuilder offlineId(String i) { o.setOfflineId(i); return this; }
        public OrdersBuilder syncedAt(LocalDateTime s) { o.setSyncedAt(s); return this; }
        public OrdersBuilder orderType(OrderType t) { o.setOrderType(t); return this; }
        public OrdersBuilder tokenNumber(String t) { o.setTokenNumber(t); return this; }
        public OrdersBuilder mergedTables(String t) { o.setMergedTables(t); return this; }
        public OrdersBuilder covers(Integer c) { o.setCovers(c); return this; }
        public OrdersBuilder billTemplate(String t) { o.setBillTemplate(t); return this; }
        public OrdersBuilder doctorName(String n) { o.setDoctorName(n); return this; }
        public OrdersBuilder numberOfDays(String d) { o.setNumberOfDays(d); return this; }
        public OrdersBuilder customerFirm(String f) { o.setCustomerFirm(f); return this; }
        public OrdersBuilder printWithGst(Boolean p) { o.setPrintWithGst(p); return this; }
        public Orders build() { return o; }
    }
}
