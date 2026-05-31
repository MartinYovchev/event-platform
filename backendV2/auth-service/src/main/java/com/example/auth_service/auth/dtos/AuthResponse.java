package com.example.auth_service.auth.dtos;

public record AuthResponse(String token, long expiresInSeconds, UserResponse user) {}

