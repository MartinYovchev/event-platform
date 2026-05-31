package com.example.booking_service.booking.reservation;

import com.example.booking_service.booking.event.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    Optional<Reservation> findByUserIdAndEventAndStatus(Long userId, Event event, ReservationStatus status);

    List<Reservation> findAllByEventAndStatusIn(Event event, Collection<ReservationStatus> statuses);

    List<Reservation> findAllByUserIdAndStatusIn(Long userId, Collection<ReservationStatus> statuses);

    @Query(value = """
        SELECT r FROM Reservation r LEFT JOIN FETCH r.event e
        WHERE r.userId = :userId
          AND ((:upcoming = TRUE  AND e.startAt >= :now AND r.status = com.example.booking_service.booking.reservation.ReservationStatus.ACTIVE)
            OR (:upcoming = FALSE AND (e.startAt < :now OR r.status = com.example.booking_service.booking.reservation.ReservationStatus.CANCELLED)))
        ORDER BY e.startAt ASC
    """,
    countQuery = """
        SELECT COUNT(r) FROM Reservation r
        WHERE r.userId = :userId
          AND ((:upcoming = TRUE  AND r.event.startAt >= :now AND r.status = com.example.booking_service.booking.reservation.ReservationStatus.ACTIVE)
            OR (:upcoming = FALSE AND (r.event.startAt < :now OR r.status = com.example.booking_service.booking.reservation.ReservationStatus.CANCELLED)))
    """)
    Page<Reservation> findMine(@Param("userId") Long userId,
                               @Param("upcoming") boolean upcoming,
                               @Param("now") Instant now,
                               Pageable pageable);
}
