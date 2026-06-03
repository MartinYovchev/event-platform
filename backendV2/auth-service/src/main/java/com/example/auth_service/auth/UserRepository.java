package com.example.auth_service.auth;

import com.example.auth_service.auth.entities.AuthProvider;
import com.example.auth_service.auth.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailAndDeletedAtIsNull(String email);
    boolean existsByEmail(String email);
    Optional<User> findByProviderAndProviderSubject(AuthProvider provider, String providerSubject);
}

