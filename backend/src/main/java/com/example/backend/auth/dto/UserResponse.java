package com.example.backend.auth.dto;

import com.example.backend.user.AuthProvider;
import com.example.backend.user.Role;
import com.example.backend.user.User;

public record UserResponse(
        Long id,
        String email,
        String displayName,
        Role role,
        AuthProvider provider
) {
    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getDisplayName(), u.getRole(), u.getProvider());
    }
}
