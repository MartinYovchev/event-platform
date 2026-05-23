package com.example.backend.me;

import com.example.backend.auth.dto.UserResponse;
import com.example.backend.event.EventService;
import com.example.backend.event.EventStatus;
import com.example.backend.event.dto.EventListItemResponse;
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
    private final EventService eventService;

    public MeController(UserRepository userRepository,
                        ReservationService reservationService,
                        EventService eventService) {
        this.userRepository = userRepository;
        this.reservationService = reservationService;
        this.eventService = eventService;
    }

    @PostMapping("/become-organizer")
    @Transactional
    public UserResponse becomeOrganizer(Authentication auth) {
        User u = requireActive(auth);
        u.setIsOrganizer(true);
        return UserResponse.from(u);
    }

    @GetMapping("/reservations")
    public Page<ReservationResponse> myReservations(
            @RequestParam(defaultValue = "upcoming") String when,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        // Resolve the caller via the active-user finder so a soft-deleted user with a
        // still-valid JWT is rejected here too.
        User me = requireActive(auth);
        boolean upcoming = "upcoming".equalsIgnoreCase(when);
        return reservationService.listMine(me.getEmail(), upcoming, page, size)
                .map(ReservationResponse::from);
    }

    @GetMapping("/events")
    public Page<EventListItemResponse> myEvents(
            @RequestParam(required = false) EventStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth) {
        User me = requireActive(auth);
        return eventService.listMine(me, status, page, size)
                .map(EventListItemResponse::from);
    }

    private User requireActive(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return userRepository.findByEmailAndDeletedAtIsNull(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
