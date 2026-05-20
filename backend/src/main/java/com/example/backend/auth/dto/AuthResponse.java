package com.example.backend.auth.dto;

public record AuthResponse(String token, long expiresInSeconds, UserResponse user) {}
