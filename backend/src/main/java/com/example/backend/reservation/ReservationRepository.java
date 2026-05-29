package com.example.backend.reservation;

import com.example.backend.event.Event;
import com.example.backend.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    Optional<Reservation> findByUserAndEventAndStatus(User user, Event event, ReservationStatus status);

    List<Reservation> findAllByEventAndStatus(Event event, ReservationStatus status);

    List<Reservation> findAllByUserAndStatus(User user, ReservationStatus status);

    Optional<Reservation> findByStripeSessionId(String stripeSessionId);

    @Query(value = """
        SELECT r FROM Reservation r LEFT JOIN FETCH r.event e
        WHERE r.user = :user
          AND ((:upcoming = TRUE  AND e.startAt >= :now AND r.status = com.example.backend.reservation.ReservationStatus.ACTIVE)
            OR (:upcoming = FALSE AND (e.startAt < :now OR r.status = com.example.backend.reservation.ReservationStatus.CANCELLED)))
        ORDER BY e.startAt ASC
    """,
    countQuery = """
        SELECT COUNT(r) FROM Reservation r
        WHERE r.user = :user
          AND ((:upcoming = TRUE  AND r.event.startAt >= :now AND r.status = com.example.backend.reservation.ReservationStatus.ACTIVE)
            OR (:upcoming = FALSE AND (r.event.startAt < :now OR r.status = com.example.backend.reservation.ReservationStatus.CANCELLED)))
    """)
    Page<Reservation> findMine(@Param("user") User user,
                               @Param("upcoming") boolean upcoming,
                               @Param("now") Instant now,
                               Pageable pageable);
}
