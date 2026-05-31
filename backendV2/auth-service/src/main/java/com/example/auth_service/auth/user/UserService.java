package com.example.auth_service.auth.user;

import com.example.auth_service.auth.UserRepository;
import com.example.auth_service.auth.dtos.ChangePasswordRequest;
import com.example.auth_service.auth.dtos.UpdateProfileRequest;
import com.example.auth_service.auth.entities.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User updateProfile(String email, UpdateProfileRequest req) {
        User u = requireActive(email);
        u.setDisplayName(req.displayName());
        return u;
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequest req) {
        User u = requireActive(email);
        if (u.getPasswordHash() == null || !passwordEncoder.matches(req.oldPassword(), u.getPasswordHash())) {
            throw new BadCredentialsException("Old password is incorrect");
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
    }

    @Transactional
    public void deleteAccount(String email) {
        User u = requireActive(email);
        u.setDeletedAt(Instant.now());
        u.setEmail("deleted_" + u.getId() + "@deleted.local");
        u.setDisplayName("Deleted user");
        u.setPasswordHash(null);
        u.setOrganizer(false);
    }

    private User requireActive(String email) {
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}