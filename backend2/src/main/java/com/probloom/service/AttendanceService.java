package com.probloom.service;

import com.probloom.exception.*;
import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;


@Service
@RequiredArgsConstructor
public class AttendanceService {
    private static final int R = 6371000; // Earth radius in meters

    private final AttendanceRepository attendanceRepository;

    private double getDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    public List<Attendance> getTodayAttendance(@NonNull User restaurant) {
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        return attendanceRepository.findByRestaurantAndDateOrderByCheckInTimeDesc(restaurant, today);
    }

    public List<Attendance> getActiveAttendance(@NonNull User restaurant) {
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        return attendanceRepository.findByRestaurantAndDateAndStatus(restaurant, today, Attendance.AttendanceStatus.ACTIVE);
    }

    public List<Attendance> getAttendanceByDate(@NonNull User restaurant, String date) {
        return attendanceRepository.findByRestaurantAndDateOrderByCheckInTimeDesc(restaurant, date);
    }

    public List<Attendance> getHistory(@NonNull User restaurant, String fromDate, String toDate) {
        return attendanceRepository.findByRestaurantDateRange(restaurant, fromDate, toDate);
    }

    @Transactional
    @NonNull
    public Attendance checkIn(@NonNull User employee, @NonNull User restaurant, Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new BadRequestException("Location coordinates are required");
        }
        if (restaurant.getLatitude() == null || restaurant.getLongitude() == null) {
            throw new BadRequestException("Restaurant location not configured");
        }

        double distance = getDistanceMeters(restaurant.getLatitude(), restaurant.getLongitude(), latitude, longitude);
        double radius = restaurant.getGeofenceRadius() != null ? restaurant.getGeofenceRadius() : 500.0;

        if (distance > radius) {
            throw new BadRequestException(String.format("Too far from restaurant (%.0fm, limit: %.0fm)", distance, radius));
        }

        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        // Check if already has active session
        boolean hasActive = attendanceRepository
                .findFirstByEmployeeAndDateAndStatusOrderByCheckInTimeDesc(employee, today, Attendance.AttendanceStatus.ACTIVE)
                .isPresent();
        if (hasActive) throw new BadRequestException("Already checked in for today");

        Attendance attendance = Attendance.builder()
                .employee(employee)
                .restaurant(restaurant)
                .date(today)
                .checkInTime(LocalDateTime.now())
                .latitude(latitude)
                .longitude(longitude)
                .lastPingTime(LocalDateTime.now())
                .status(Attendance.AttendanceStatus.ACTIVE)
                .build();

        Attendance saved = attendanceRepository.save(java.util.Objects.requireNonNull(attendance));
        return saved;

    }

    @Transactional
    @NonNull
    public Attendance checkOut(@NonNull User employee, @NonNull User restaurant) {
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        Attendance attendance = attendanceRepository
                .findFirstByEmployeeAndDateAndStatusOrderByCheckInTimeDesc(employee, today, Attendance.AttendanceStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("No active check-in found for today"));

        LocalDateTime checkOut = LocalDateTime.now();
        long minutes = java.time.Duration.between(attendance.getCheckInTime(), checkOut).toMinutes();
        double totalHours = Math.round((minutes / 60.0) * 100.0) / 100.0;

        attendance.setCheckOutTime(checkOut);
        attendance.setTotalHours(totalHours);
        attendance.setStatus(Attendance.AttendanceStatus.COMPLETED);

        Attendance savedOut = attendanceRepository.save(java.util.Objects.requireNonNull(attendance));
        return savedOut;

    }

    @Transactional
    public void ping(@NonNull User employee, @NonNull User restaurant, Double latitude, Double longitude) {
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        attendanceRepository.findFirstByEmployeeAndDateAndStatusOrderByCheckInTimeDesc(employee, today, Attendance.AttendanceStatus.ACTIVE)
                .ifPresent(a -> {
                    if (latitude != null && longitude != null && restaurant.getLatitude() != null) {
                        double distance = getDistanceMeters(restaurant.getLatitude(), restaurant.getLongitude(), latitude, longitude);
                        double radius = restaurant.getGeofenceRadius() != null ? restaurant.getGeofenceRadius() : 500.0;
                        if (distance > radius) {
                            // Auto check-out if outside
                            LocalDateTime now = LocalDateTime.now();
                            long minutes = java.time.Duration.between(a.getCheckInTime(), now).toMinutes();
                            a.setTotalHours(Math.round((minutes / 60.0) * 100.0) / 100.0);
                            a.setCheckOutTime(now);
                            a.setDisconnectedAt(now);
                            a.setStatus(Attendance.AttendanceStatus.DISCONNECTED);
                        } else {
                            a.setLastPingTime(LocalDateTime.now());
                        }
                    } else {
                        a.setLastPingTime(LocalDateTime.now());
                    }
                    attendanceRepository.save(a);
                });
    }
}
