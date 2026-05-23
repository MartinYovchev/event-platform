package com.example.backend.common;

import java.util.List;

public record ErrorResponse(String code, String message, List<FieldError> fields) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }

    public record FieldError(String field, String error) {}
}
