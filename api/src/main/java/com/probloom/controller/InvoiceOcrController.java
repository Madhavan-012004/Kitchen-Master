package com.probloom.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.probloom.service.InvoiceOcrService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/inventory")
public class InvoiceOcrController {

    @Autowired
    private InvoiceOcrService invoiceOcrService;

    @PostMapping("/scan-invoice-python")
    public ResponseEntity<?> scanInvoiceOffline(@RequestParam("file") MultipartFile file) {
        try {
            JsonNode result = invoiceOcrService.scanInvoiceOffline(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error processing invoice: " + e.getMessage());
        }
    }
}
