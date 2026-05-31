package com.example.auth_service.auth.dtos;

import com.example.auth_service.auth.entities.AuthProvider;
import com.example.auth_service.auth.entities.Role;
import com.example.auth_service.auth.entities.User;

import java.time.Instant;

public record UserResponse(
        Long id,
        String email,
        String displayName,
        Role role,
        AuthProvider provider,
        Boolean isOrganizer,
        Instant createdAt
) {
    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                u.getRole(),
                u.getProvider(),
                Boolean.TRUE.equals(u.getOrganizer()),
                u.getCreatedAt()
        );
    }
}
