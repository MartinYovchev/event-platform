package com.example.backend.user;

import com.example.backend.event.Event;
import com.example.backend.event.EventRepository;
import com.example.backend.event.EventService;
import com.example.backend.event.EventStatus;
import com.example.backend.reservation.Reservation;
import com.example.backend.reservation.ReservationRepository;
import com.example.backend.reservation.ReservationStatus;
import com.example.backend.user.dto.ChangePasswordRequest;
import com.example.backend.user.dto.UpdateProfileRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final EventService eventService;
    private final ReservationRepository reservationRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       EventRepository eventRepository,
                       EventService eventService,
                       ReservationRepository reservationRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.eventService = eventService;
        this.reservationRepository = reservationRepository;
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

        // 1. Cancel every ACTIVE reservation this user holds. Release seats from
        //    PUBLISHED events; adjustSeats no-ops for any other status.
        for (Reservation r : reservationRepository.findAllByUserAndStatus(u, ReservationStatus.ACTIVE)) {
            Event e = r.getEvent();
            eventRepository.adjustSeats(e.getId(), -r.getQuantity());
            r.setStatus(ReservationStatus.CANCELLED);
        }

        // 2. Cancel every DRAFT or PUBLISHED event this user organizes. The shared
        //    cascade also cancels reservations placed by *other* users on those events.
        for (Event e : eventRepository.findAllByOrganizerAndStatusIn(u,
                List.of(EventStatus.DRAFT, EventStatus.PUBLISHED))) {
            eventService.applyCancellation(e);
        }

        // 3. Anonymize + tombstone. The email rewrite frees the original address
        //    for re-registration.
        u.setDeletedAt(Instant.now());
        u.setEmail("deleted_" + u.getId() + "@deleted.local");
        u.setDisplayName("Deleted user");
        u.setPasswordHash(null);
        u.setIsOrganizer(false);
    }

    private User requireActive(String email) {
        return userRepository.findByEmailAndDeletedAtIsNull(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
