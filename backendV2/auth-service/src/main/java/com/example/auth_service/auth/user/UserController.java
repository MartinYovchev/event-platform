package com.example.auth_service.auth.user;

import com.example.auth_service.auth.UserRepository;
import com.example.auth_service.auth.dtos.ChangePasswordRequest;
import com.example.auth_service.auth.dtos.UpdateProfileRequest;
import com.example.auth_service.auth.dtos.UserResponse;
import com.example.auth_service.auth.entities.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    public UserController(UserRepository userRepository, UserService userService) {
        this.userRepository = userRepository;
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserResponse me(Authentication auth) {
        return UserResponse.from(requireActive(auth));
    }

    @PatchMapping("/me")
    public UserResponse updateMe(@Valid @RequestBody UpdateProfileRequest req, Authentication auth) {
        if (auth == null || auth.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return UserResponse.from(userService.updateProfile(auth.getName(), req));
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req, Authentication auth) {
        if (auth == null || auth.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        userService.changePassword(auth.getName(), req);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/become-organizer")
    @Transactional
    public UserResponse becomeOrganizer(Authentication auth) {
        User u = requireActive(auth);
        u.setOrganizer(true);
        return UserResponse.from(u);
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(Authentication auth) {
        if (auth == null || auth.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        userService.deleteAccount(auth.getName());
        return ResponseEntity.noContent().build();
    }

    private User requireActive(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return userRepository.findByEmailAndDeletedAtIsNull(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}