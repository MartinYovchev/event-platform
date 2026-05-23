package com.example.backend.event;

import com.example.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long>, JpaSpecificationExecutor<Event> {

    Optional<Event> findByIdAndStatus(Long id, EventStatus status);

    List<Event> findAllByOrganizerAndStatusIn(User organizer, Collection<EventStatus> statuses);

    /**
     * Atomically bump seats_taken by :delta (positive = reserve, negative = release).
     * No-op (returns 0) if the event is not PUBLISHED or the result would violate the
     * capacity bounds. The service treats 0 as "409 — insufficient capacity / wrong status".
     * events.updated_at is maintained by the V2 trigger; no need to set it here.
     */
    @Modifying
    @Query(value = """
        UPDATE events
           SET seats_taken = seats_taken + :delta
         WHERE id = :eventId
           AND status = 'PUBLISHED'
           AND seats_taken + :delta >= 0
           AND seats_taken + :delta <= capacity
    """, nativeQuery = true)
    int adjustSeats(@Param("eventId") Long eventId, @Param("delta") int delta);
}
