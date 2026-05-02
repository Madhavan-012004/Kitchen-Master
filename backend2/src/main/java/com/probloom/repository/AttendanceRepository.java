package com.probloom.repository;

import com.probloom.model.entity.Attendance;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByRestaurantAndDateOrderByCheckInTimeDesc(@Param("restaurant") User restaurant, @Param("date") String date);
    List<Attendance> findByEmployeeAndDateOrderByCheckInTimeAsc(@Param("employee") User employee, @Param("date") String date);
    Optional<Attendance> findFirstByEmployeeAndDateAndStatusOrderByCheckInTimeDesc(@Param("employee") User employee, @Param("date") String date, @Param("status") Attendance.AttendanceStatus status);
    List<Attendance> findByRestaurantAndDateAndStatus(@Param("restaurant") User restaurant, @Param("date") String date, @Param("status") Attendance.AttendanceStatus status);

    @Query("SELECT a FROM Attendance a WHERE a.restaurant = :restaurant AND a.date BETWEEN :fromDate AND :toDate ORDER BY a.date DESC, a.checkInTime DESC")
    List<Attendance> findByRestaurantDateRange(@Param("restaurant") User restaurant, @Param("fromDate") String fromDate, @Param("toDate") String toDate);
}
