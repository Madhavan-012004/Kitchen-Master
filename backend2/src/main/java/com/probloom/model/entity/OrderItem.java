package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.*;
import jakarta.persistence.*;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonBackReference
    private Orders order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    @JsonIgnore
    private MenuItem menuItem;

    @Column(name = "inventory_item_id")
    private Long inventoryItemId;

    @Column
    private String barcode;

    @Column(nullable = false)
    private String name;

    @Column
    private String category;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double price;

    @Column(name = "tax_rate")
    private Double taxRate = 0.0;

    @Column(columnDefinition = "TEXT")
    private String notes = "";

    @Enumerated(EnumType.STRING)
    private ItemStatus status = ItemStatus.PREPARING;

    @Column(name = "completed_quantity")
    private Integer completedQuantity = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "added_by")
    @JsonIgnore
    private User addedBy;

    @Column(name = "added_by_name")
    private String addedByName;

    @Column(name = "batch_no")
    private String batchNo;

    @Column(name = "mfg_date")
    private String mfgDate;

    @Column(name = "exp_date")
    private String expDate;

    @Column(name = "hsn_code")
    private String hsnCode;

    @Column
    private Double mrp;

    @Column(name = "dis_pct")
    private Double disPct = 0.0;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Orders getOrder() { return order; }
    public void setOrder(Orders order) { this.order = order; }
    public MenuItem getMenuItem() { return menuItem; }
    public void setMenuItem(MenuItem menuItem) { this.menuItem = menuItem; }
    public Long getInventoryItemId() { return inventoryItemId; }
    public void setInventoryItemId(Long inventoryItemId) { this.inventoryItemId = inventoryItemId; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }
    public Double getTaxRate() { return taxRate; }
    public void setTaxRate(Double taxRate) { this.taxRate = taxRate; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public ItemStatus getStatus() { return status; }
    public void setStatus(ItemStatus status) { this.status = status; }
    public Integer getCompletedQuantity() { return completedQuantity; }
    public void setCompletedQuantity(Integer completedQuantity) { this.completedQuantity = completedQuantity; }
    public User getAddedBy() { return addedBy; }
    public void setAddedBy(User addedBy) { this.addedBy = addedBy; }

    @JsonProperty("menuItemId")
    public Long getMenuItemId() { return menuItem != null ? menuItem.getId() : null; }

    @JsonProperty("addedById")
    public Long getAddedById() { return addedBy != null ? addedBy.getId() : null; }
    public String getAddedByName() { return addedByName; }
    public void setAddedByName(String addedByName) { this.addedByName = addedByName; }

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getMfgDate() { return mfgDate; }
    public void setMfgDate(String mfgDate) { this.mfgDate = mfgDate; }
    public String getExpDate() { return expDate; }
    public void setExpDate(String expDate) { this.expDate = expDate; }
    public String getHsnCode() { return hsnCode; }
    public void setHsnCode(String hsnCode) { this.hsnCode = hsnCode; }
    public Double getMrp() { return mrp; }
    public void setMrp(Double mrp) { this.mrp = mrp; }
    public Double getDisPct() { return disPct; }
    public void setDisPct(Double disPct) { this.disPct = disPct; }

    public enum ItemStatus {
        PENDING, PREPARING, READY, SERVED, CANCELLED
    }

    public static OrderItemBuilder builder() { return new OrderItemBuilder(); }
    public static class OrderItemBuilder {
        private OrderItem item = new OrderItem();
        public OrderItemBuilder order(Orders o) { item.setOrder(o); return this; }
        public OrderItemBuilder menuItem(MenuItem m) { item.setMenuItem(m); return this; }
        public OrderItemBuilder inventoryItemId(Long id) { item.setInventoryItemId(id); return this; }
        public OrderItemBuilder barcode(String b) { item.setBarcode(b); return this; }
        public OrderItemBuilder name(String n) { item.setName(n); return this; }
        public OrderItemBuilder category(String c) { item.setCategory(c); return this; }
        public OrderItemBuilder quantity(Integer q) { item.setQuantity(q); return this; }
        public OrderItemBuilder price(Double p) { item.setPrice(p); return this; }
        public OrderItemBuilder taxRate(Double t) { item.setTaxRate(t); return this; }
        public OrderItemBuilder notes(String n) { item.setNotes(n); return this; }
        public OrderItemBuilder status(ItemStatus s) { item.setStatus(s); return this; }
        public OrderItemBuilder completedQuantity(Integer cq) { item.setCompletedQuantity(cq); return this; }
        public OrderItemBuilder addedBy(User u) { item.setAddedBy(u); return this; }
        public OrderItemBuilder addedByName(String n) { item.setAddedByName(n); return this; }
        public OrderItemBuilder batchNo(String b) { item.setBatchNo(b); return this; }
        public OrderItemBuilder mfgDate(String d) { item.setMfgDate(d); return this; }
        public OrderItemBuilder expDate(String d) { item.setExpDate(d); return this; }
        public OrderItemBuilder hsnCode(String h) { item.setHsnCode(h); return this; }
        public OrderItemBuilder mrp(Double m) { item.setMrp(m); return this; }
        public OrderItemBuilder disPct(Double d) { item.setDisPct(d); return this; }
        public OrderItem build() { return item; }
    }
}
