package com.example.backend.auth;

import com.example.backend.auth.components.GoogleTokenVerifier;
import com.example.backend.auth.dto.AuthResponse;
import com.example.backend.auth.dto.LoginRequest;
import com.example.backend.auth.dto.RegisterRequest;
import com.example.backend.auth.dto.UserResponse;
import com.example.backend.user.AuthProvider;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       GoogleTokenVerifier googleTokenVerifier) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        User u = new User();
        u.setEmail(req.email());
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setDisplayName(req.displayName());
        User saved = userRepository.save(u);
        return toAuthResponse(saved);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(req.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        return toAuthResponse(user);
    }

    public AuthResponse toAuthResponse(User user) {
        String token = jwtService.issue(user);
        return new AuthResponse(token, jwtService.getExpirationSeconds(), UserResponse.from(user));
    }

    @Transactional
    public AuthResponse loginWithGoogle(String idToken) {
        GoogleTokenVerifier.GoogleUser g = googleTokenVerifier.verify(idToken);

        User user = userRepository
                .findByProviderAndProviderSubject(AuthProvider.GOOGLE, g.subject())
                .orElse(null);

        if (user != null) {
            if (user.getDeletedAt() != null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is no longer active");
            }
        } else {
            if (userRepository.existsByEmail(g.email())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This email is already registered. Please sign in with your password.");
            }
            user = new User();
            user.setEmail(g.email());
            user.setProvider(AuthProvider.GOOGLE);
            user.setProviderSubject(g.subject());
            user.setPasswordHash(null);

            String displayName = (g.name() != null && !g.name().isBlank())
                    ? g.name() : g.email().split("@")[0];
            if (displayName.length() > 100) displayName = displayName.substring(0, 100);
            user.setDisplayName(displayName);

            user = userRepository.save(user);
        }

        return toAuthResponse(user);
    }
}
