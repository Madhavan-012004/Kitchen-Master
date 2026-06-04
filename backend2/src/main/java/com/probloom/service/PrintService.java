package com.probloom.service;

import com.probloom.model.entity.Orders;
import com.probloom.model.entity.OrderItem;
import com.probloom.model.entity.User;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
public class PrintService {

    private static final byte[] INIT = {0x1B, 0x40};
    private static final byte[] CUT = {0x1D, 0x56, 0x41, 0x10};
    private static final byte[] ALIGN_LEFT = {0x1B, 0x61, 0};
    private static final byte[] ALIGN_CENTER = {0x1B, 0x61, 1};
    private static final byte[] ALIGN_RIGHT = {0x1B, 0x61, 2};
    private static final byte[] BOLD_ON = {0x1B, 0x45, 1};
    private static final byte[] BOLD_OFF = {0x1B, 0x45, 0};
    private static final byte[] SIZE_NORMAL = {0x1D, 0x21, 0x00};
    private static final byte[] SIZE_DOUBLE = {0x1D, 0x21, 0x11};
    private static final byte[] SIZE_DOUBLE_H = {0x1D, 0x21, 0x01};

    private void write(OutputStream out, String text) throws Exception {
        out.write(text.getBytes(StandardCharsets.UTF_8));
    }

    private void write(OutputStream out, byte[] command) throws Exception {
        out.write(command);
    }

    private String getDisplayName(Orders order) {
        if (order.getTableNumber() != null && !order.getTableNumber().isEmpty()) {
            return "Table " + order.getTableNumber();
        }
        if (order.getTokenNumber() != null && !order.getTokenNumber().isEmpty()) {
            return "Token " + order.getTokenNumber();
        }
        return "Takeaway";
    }

    /**
     * Prints a KOT (Kitchen Order Ticket) directly to the specified IP Address
     */
    public boolean printKOT(Orders order, String printerIp) {
        if (printerIp == null || printerIp.trim().isEmpty()) return false;

        try (Socket socket = new Socket(printerIp.trim(), 9100);
             OutputStream out = socket.getOutputStream()) {

            write(out, INIT);
            write(out, ALIGN_CENTER);
            write(out, BOLD_ON);
            write(out, SIZE_DOUBLE);
            write(out, "KOT\n");
            
            write(out, SIZE_NORMAL);
            write(out, "--------------------------------\n");
            write(out, ALIGN_LEFT);
            
            write(out, SIZE_DOUBLE_H);
            write(out, "Order: " + (order.getOrderNumber() != null ? order.getOrderNumber() : order.getId().toString().substring(0, 8)) + "\n");
            write(out, "Loc: " + getDisplayName(order) + "\n");
            write(out, SIZE_NORMAL);
            
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm");
            write(out, "Date: " + order.getCreatedAt().format(formatter) + "\n");
            
            if (order.getWaiterName() != null) {
                write(out, "Wait: " + order.getWaiterName() + "\n");
            }

            write(out, "--------------------------------\n");
            write(out, BOLD_ON);
            write(out, SIZE_DOUBLE_H);
            write(out, String.format("%-25s %4s\n", "ITEM", "QTY"));
            write(out, SIZE_NORMAL);
            write(out, BOLD_OFF);
            write(out, "--------------------------------\n");

            // Items
            int totalItems = 0;
            write(out, BOLD_ON);
            write(out, SIZE_DOUBLE_H);
            if (order.getItems() != null) {
                for (OrderItem item : order.getItems()) {
                    totalItems += item.getQuantity();
                    String name = item.getName();
                    if (name.length() > 25) name = name.substring(0, 25);
                    write(out, String.format("%-25s %4d\n", name, item.getQuantity()));
                    
                    if (item.getNotes() != null && !item.getNotes().isEmpty()) {
                        write(out, SIZE_NORMAL);
                        write(out, " *Note: " + item.getNotes() + "\n");
                        write(out, SIZE_DOUBLE_H);
                    }
                }
            }
            write(out, SIZE_NORMAL);
            write(out, BOLD_OFF);
            
            write(out, "--------------------------------\n");
            write(out, ALIGN_CENTER);
            write(out, "Total Items: " + totalItems + "\n");
            
            // Feed and Cut
            write(out, "\n\n\n\n");
            write(out, CUT);

            out.flush();
            System.out.println("✅ IP Print KOT Success: " + printerIp);
            return true;
        } catch (Exception e) {
            System.err.println("❌ IP Print KOT Failed to " + printerIp + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Prints a Customer Bill directly to the specified IP Address
     */
    public boolean printBill(Orders order, User restaurant, String printerIp) {
        if (printerIp == null || printerIp.trim().isEmpty()) return false;

        try (Socket socket = new Socket(printerIp.trim(), 9100);
             OutputStream out = socket.getOutputStream()) {

            write(out, INIT);
            
            // Header
            write(out, ALIGN_CENTER);
            write(out, BOLD_ON);
            write(out, SIZE_DOUBLE);
            write(out, (restaurant.getRestaurantName() != null ? restaurant.getRestaurantName() : "RESTAURANT") + "\n");
            write(out, SIZE_NORMAL);
            write(out, BOLD_OFF);

            if (restaurant.getAddress() != null) {
                write(out, restaurant.getAddress() + "\n");
            }
            if (restaurant.getPhone() != null) {
                write(out, "Ph: " + restaurant.getPhone() + "\n");
            }
            boolean printGst = Boolean.TRUE.equals(order.getPrintWithGst()) || (order.getPrintWithGst() == null && order.getTaxAmount() != null && order.getTaxAmount() > 0.0);

            if (printGst && restaurant.getGstNumber() != null && !restaurant.getGstNumber().isEmpty()) {
                write(out, "GSTIN: " + restaurant.getGstNumber() + "\n");
            }
            
            write(out, "--------------------------------\n");
            write(out, BOLD_ON);
            write(out, printGst ? "TAX INVOICE\n" : "RETAIL BILL\n");
            write(out, BOLD_OFF);
            write(out, "--------------------------------\n");

            // Meta
            write(out, ALIGN_LEFT);
            write(out, "Bill No : " + (order.getOrderNumber() != null ? order.getOrderNumber() : order.getId().toString().substring(0, 8)) + "\n");
            write(out, "Loc     : " + getDisplayName(order) + "\n");
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm");
            write(out, "Date    : " + order.getCreatedAt().format(formatter) + "\n");
            if (order.getWaiterName() != null) {
                write(out, "Staff   : " + order.getWaiterName() + "\n");
            }
            write(out, "--------------------------------\n");

            // Items Table
            write(out, BOLD_ON);
            write(out, String.format("%-6s %-12s %4s %8s\n", "Cat", "Item", "Qty", "Amt"));
            write(out, BOLD_OFF);
            write(out, "--------------------------------\n");

            if (order.getItems() != null) {
                for (OrderItem item : order.getItems()) {
                    String cat = item.getCategory() != null ? item.getCategory() : "-";
                    if (cat.length() > 6) cat = cat.substring(0, 6);
                    String name = item.getName();
                    if (name.length() > 12) name = name.substring(0, 12);
                    double price = item.getPrice() != null ? item.getPrice() : 0.0;
                    double quantity = item.getQuantity() != null ? item.getQuantity() : 0;
                    double tot = price * quantity;
                    if (printGst) {
                        double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                        double itemTax = (tot * rate) / (100.0 + rate);
                        tot = tot - itemTax;
                    }
                    
                    write(out, String.format("%-6s %-12s %4d %8.2f\n", cat, name, item.getQuantity(), tot));
                }
            }
            write(out, "--------------------------------\n");

            // Totals
            write(out, ALIGN_RIGHT);
            
            double subtotal = order.getSubtotal() != null ? order.getSubtotal() : 0.0;
            double extraTotal = 0.0;
            if (order.getExtraCharges() != null && !order.getExtraCharges().isEmpty()) {
                for (com.probloom.model.entity.ExtraCharge charge : order.getExtraCharges()) {
                    extraTotal += charge.getAmount();
                }
            }
            double discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : 0.0;
            double tax = printGst && order.getTaxAmount() != null ? order.getTaxAmount() : 0.0;
            double finalTotal = subtotal + extraTotal + tax - discount;

            write(out, String.format("Subtotal:  %7.2f\n", subtotal));
            
            if (order.getExtraCharges() != null && !order.getExtraCharges().isEmpty()) {
                for (com.probloom.model.entity.ExtraCharge charge : order.getExtraCharges()) {
                    String cName = charge.getName();
                    if (cName.length() > 14) cName = cName.substring(0, 14);
                    write(out, String.format("%s:  %7.2f\n", cName, charge.getAmount()));
                }
            }
            
            if (printGst && tax > 0) {
                double halfTax = tax / 2.0;
                write(out, String.format("SGST:  %7.2f\n", halfTax));
                write(out, String.format("CGST:  %7.2f\n", halfTax));
            }

            if (discount > 0) {
                write(out, String.format("Discount: -%7.2f\n", discount));
            }
            
            write(out, "--------------------------------\n");
            write(out, BOLD_ON);
            write(out, SIZE_DOUBLE_H);
            write(out, String.format("TOTAL: %7.2f\n", finalTotal));
            write(out, SIZE_NORMAL);
            write(out, BOLD_OFF);
            write(out, "--------------------------------\n");

            // Footer
            write(out, ALIGN_CENTER);
            write(out, "Payment: " + (order.getPaymentMethod() != null ? order.getPaymentMethod().name().toUpperCase() : "CASH") + "\n");
            write(out, "\nThank You! Please Visit Again.\n");
            write(out, "Software by ProBloom\n");

            // Feed and Cut
            write(out, "\n\n\n\n");
            write(out, CUT);

            out.flush();
            System.out.println("✅ IP Print Bill Success: " + printerIp);
            return true;
        } catch (Exception e) {
            System.err.println("❌ IP Print Bill Failed to " + printerIp + ": " + e.getMessage());
            return false;
        }
    }
}
