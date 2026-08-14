package com.probloom.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Collectors;

@Service

public class InvoiceOcrService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public JsonNode scanInvoiceOffline(MultipartFile file) throws Exception {
        // 1. Save uploaded file to temp directory
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        Path tempFile = Files.createTempFile("invoice_upload_", extension);
        file.transferTo(tempFile.toFile());

        try {
            // 2. Execute Python Script
            String pythonScriptPath = new File("Invoice_Extraction_Project/app/main.py").getAbsolutePath();

            String pythonBinDir = System.getProperty("PYTHON_BIN_DIR");
            String pythonExe = "python";
            if (pythonBinDir != null && !pythonBinDir.isEmpty()) {
                File bundledPython = new File(pythonBinDir, "python.exe");
                if (bundledPython.exists()) {
                    pythonExe = bundledPython.getAbsolutePath();
                }
            }

            ProcessBuilder processBuilder = new ProcessBuilder(
                    pythonExe, pythonScriptPath, "--file", tempFile.toAbsolutePath().toString());
            processBuilder.environment().put("PYTHONIOENCODING", "utf-8");

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            // 3. Read output
            String output;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                output = reader.lines().collect(Collectors.joining("\n"));
            }

            int exitCode = process.waitFor();

            if (exitCode != 0) {
                throw new RuntimeException("Python script failed with exit code " + exitCode + ". Output:\n" + output);
            }

            // 4. Find the JSON part of the output (in case PaddleOCR prints logs)
            String jsonPart = extractJson(output);
            if (jsonPart == null) {
                throw new RuntimeException("Could not find valid JSON in python output:\n" + output);
            }

            return objectMapper.readTree(jsonPart);

        } finally {
            // 5. Cleanup
            Files.deleteIfExists(tempFile);
        }
    }

    private String extractJson(String output) {
        int startIndex = output.indexOf("{");
        int lastIndex = output.lastIndexOf("}");
        if (startIndex != -1 && lastIndex != -1 && lastIndex > startIndex) {
            return output.substring(startIndex, lastIndex + 1);
        }
        return null;
    }
}
