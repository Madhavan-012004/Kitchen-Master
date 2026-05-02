package com.probloom.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import javax.print.*;
import javax.print.attribute.HashPrintRequestAttributeSet;

@RestController
@RequestMapping("/api/print")
public class PrinterController {

    @PostMapping("/raw")
    public ResponseEntity<?> printRaw(@RequestBody Map<String, String> payload) {
        String tsplData = payload.get("data");
        String printerName = payload.getOrDefault("printerName", "TSC");

        if (tsplData == null || tsplData.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No TSPL data provided"));
        }

        try {
            // Find the printer by its name
            PrintService[] services = PrintServiceLookup.lookupPrintServices(null, null);
            PrintService printer = null;
            
            for (PrintService service : services) {
                if (service.getName().equalsIgnoreCase(printerName)) {
                    printer = service;
                    break;
                }
            }

            if (printer == null) {
                StringBuilder avail = new StringBuilder();
                for (PrintService s : services) avail.append("'").append(s.getName()).append("', ");
                return ResponseEntity.status(404).body(Map.of(
                    "success", false, 
                    "message", "Printer '" + printerName + "' not found. Your Windows printer names are: " + avail.toString()
                ));
            }

            // Prepare the document for raw printing
            byte[] bytes = tsplData.getBytes(StandardCharsets.ISO_8859_1);
            DocFlavor flavor = DocFlavor.BYTE_ARRAY.AUTOSENSE;
            Doc doc = new SimpleDoc(bytes, flavor, null);
            
            // Create and execute the print job
            DocPrintJob job = printer.createPrintJob();
            job.print(doc, new HashPrintRequestAttributeSet());

            return ResponseEntity.ok(Map.of("success", true, "message", "Raw data sent to printer '" + printerName + "' successfully"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("success", false, "message", "Server error: " + e.getMessage()));
        }
    }
}
