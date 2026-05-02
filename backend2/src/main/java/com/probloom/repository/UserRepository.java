package com.probloom.repository;

import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(@Param("email") String email);
    boolean existsByEmail(@Param("email") String email);
    List<User> findByParentOwner(@Param("parentOwner") User parentOwner);
    List<User> findByParentOwnerAndIsActiveTrue(@Param("parentOwner") User parentOwner);
    Optional<User> findFirstByPhone(@Param("phone") String phone);
}
