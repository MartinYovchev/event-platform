package com.example.backend.me;

import com.example.backend.auth.dto.UserResponse;
import com.example.backend.reservation.ReservationService;
import com.example.backend.reservation.dto.ReservationResponse;
import com.example.backend.user.User;
import com.example.backend.user.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserRepository userRepository;
    private final ReservationService reservationService;

    public MeController(UserRepository userRepository, ReservationService reservationService) {
        this.userRepository = userRepository;
        this.reservationService = reservationService;
    }

    @PostMapping("/become-organizer")
    @Transactional
    public UserResponse becomeOrganizer(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        User u = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        u.setIsOrganizer(true);
        return UserResponse.from(u);
    }

    @GetMapping("/reservations")
    public Page<ReservationResponse> myReservations(
            @RequestParam(defaultValue = "upcoming") String when,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        boolean upcoming = "upcoming".equalsIgnoreCase(when);
        return reservationService.listMine(auth.getName(), upcoming, page, size)
                .map(ReservationResponse::from);
    }
}
