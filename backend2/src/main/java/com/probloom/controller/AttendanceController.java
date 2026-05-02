package com.probloom.controller;
import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;

import com.probloom.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import java.util.LinkedHashMap;
import java.util.Map;


@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final CurrentUserResolver resolver;

    @GetMapping
    public ResponseEntity<?> getToday(
            @RequestParam(value = "date", required = false) String date,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);

        String targetDate = date != null ? date : java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        java.util.List<com.probloom.model.entity.Attendance> rawRecords = attendanceService.getAttendanceByDate(restaurant, targetDate);
        
        // Group by employee for history view
        java.util.Map<Long, java.util.Map<String, Object>> grouped = new java.util.HashMap<>();
        for (com.probloom.model.entity.Attendance entry : rawRecords) {
            Long empId = entry.getEmployee().getId();
            grouped.putIfAbsent(empId, new java.util.HashMap<>());
            java.util.Map<String, Object> empData = grouped.get(empId);
            
            if (!empData.containsKey("employeeId")) {
                empData.put("employeeId", entry.getEmployee());
                empData.put("date", entry.getDate());
                empData.put("totalHours", 0.0);
                empData.put("sessions", new java.util.ArrayList<java.util.Map<String, Object>>());
            }
            
            empData.put("totalHours", (double)empData.get("totalHours") + (entry.getTotalHours() != null ? entry.getTotalHours() : 0.0));
            @SuppressWarnings("unchecked")
            java.util.List<java.util.Map<String, Object>> sessions = (java.util.List<java.util.Map<String, Object>>) empData.get("sessions");
            
            java.util.Map<String, Object> session = new java.util.HashMap<>();
            session.put("checkInTime", entry.getCheckInTime());
            session.put("checkOutTime", entry.getCheckOutTime());
            session.put("status", entry.getStatus().toString().toLowerCase());
            session.put("hours", entry.getTotalHours());
            sessions.add(session);
        }

        return ok("Attendance records", Map.of("records", grouped.values()));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActive(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        java.util.List<com.probloom.model.entity.Attendance> active = attendanceService.getActiveAttendance(restaurant);
        return ok("Active employees", Map.of("active", active, "count", active.size()));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestParam("fromDate") String fromDate,
            @RequestParam("toDate") String toDate,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        return ok("Attendance history", Map.of("attendance", attendanceService.getHistory(restaurant, fromDate, toDate)));
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        User employee = resolver.getCurrentUser();
        // Stakeholders don't have personal attendance status
        if (employee.getRole() == User.Role.STAKEHOLDER) {
            return ok("Stakeholders skip attendance", Map.of("isActive", false));
        }
        User restaurant = resolver.getRestaurantOwner();
        com.probloom.model.entity.Attendance session = attendanceService.getTodayAttendance(restaurant)
                .stream().filter(a -> a.getEmployee().getId().equals(employee.getId()) && a.getStatus() == com.probloom.model.entity.Attendance.AttendanceStatus.ACTIVE)
                .findFirst().orElse(null);

        Map<String, Object> data = new java.util.HashMap<>();
        data.put("isActive", session != null);
        if (session != null) {
            data.put("checkInTime", session.getCheckInTime());
            data.put("_id", session.getId());
        }
        return ok("Attendance status", data);
    }

    @PostMapping({"/check-in", "/checkin"})
    public ResponseEntity<?> checkIn(@RequestBody Map<String, Object> body) {
        User employee = resolver.getCurrentUser();
        User restaurant = resolver.getRestaurantOwner();
        Double lat = body.get("latitude") != null ? Double.valueOf(body.get("latitude").toString()) : null;
        Double lon = body.get("longitude") != null ? Double.valueOf(body.get("longitude").toString()) : null;
        return ok("Checked in", attendanceService.checkIn(employee, restaurant, lat, lon));
    }

    @PostMapping({"/check-out", "/checkout"})
    public ResponseEntity<?> checkOut() {
        User employee = resolver.getCurrentUser();
        User restaurant = resolver.getRestaurantOwner();
        return ok("Checked out", attendanceService.checkOut(employee, restaurant));
    }

    @PostMapping("/ping")
    public ResponseEntity<?> ping(@RequestBody Map<String, Object> body) {
        User employee = resolver.getCurrentUser();
        User restaurant = resolver.getRestaurantOwner();
        Double lat = body.get("latitude") != null ? Double.valueOf(body.get("latitude").toString()) : null;
        Double lon = body.get("longitude") != null ? Double.valueOf(body.get("longitude").toString()) : null;
        attendanceService.ping(employee, restaurant, lat, lon);
        return ok("Ping received", null);
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
