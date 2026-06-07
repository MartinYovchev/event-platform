-- A confirmed reservation now triggers a QR-code email and can be checked in at the door by
-- the organizer. We denormalize the attendee's contact details onto the reservation (captured
-- from the JWT at reserve time) so the async payment-confirmation path — which only carries a
-- reservationId — still has the email/name needed to send the notification. The attended flag
-- + checked_in_at record the door scan; check-in is all-or-nothing per reservation.

ALTER TABLE reservations ADD COLUMN user_email   TEXT;
ALTER TABLE reservations ADD COLUMN user_name     TEXT;
ALTER TABLE reservations ADD COLUMN attended      BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN checked_in_at TIMESTAMPTZ NULL;
