package com.example.auth_service.auth.dtos;

import jakarta.validation.constraints.NotBlank;

public record GoogleAuthRequest(@NotBlank String idToken) {}

