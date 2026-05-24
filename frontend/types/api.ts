// Source of truth for backend DTO shapes.
//
// Mirrors the Spring Boot backend at /backend/src/main/java/com/example/backend.
// Maintained by `backend-watcher-beacon`. Do not edit by hand without coordinating
// via the team protocol — consumers (`api-courier-cobalt` hooks, forms, etc.) depend on these.
//
// Mapping:
//   Role                     -> com.example.backend.user.Role
//   AuthProvider             -> com.example.backend.user.AuthProvider
//   EventStatus              -> com.example.backend.event.EventStatus
//   ReservationStatus        -> com.example.backend.reservation.ReservationStatus
//   UserResponse             -> com.example.backend.auth.dto.UserResponse
//   AuthResponse             -> com.example.backend.auth.dto.AuthResponse
//   LoginRequest             -> com.example.backend.auth.dto.LoginRequest
//   RegisterRequest          -> com.example.backend.auth.dto.RegisterRequest
//   UpdateProfileRequest     -> com.example.backend.user.dto.UpdateProfileRequest
//   ChangePasswordRequest    -> com.example.backend.user.dto.ChangePasswordRequest
//   EventResponse            -> com.example.backend.event.dto.EventResponse
//   EventListItemResponse    -> com.example.backend.event.dto.EventListItemResponse
//   CreateEventRequest       -> com.example.backend.event.dto.CreateEventRequest
//   UpdateEventRequest       -> com.example.backend.event.dto.UpdateEventRequest
//   ReservationResponse      -> com.example.backend.reservation.dto.ReservationResponse
//   CreateReservationRequest -> com.example.backend.reservation.dto.CreateReservationRequest
//   ErrorResponse            -> com.example.backend.common.ErrorResponse
//   Page<T>                  -> org.springframework.data.domain.Page (default Jackson shape)
//
// Conventions:
//   - All `Instant` fields are ISO-8601 strings (Spring's default Jackson serialization).
//   - All `BigDecimal` fields (e.g. `price`) are decimal strings to preserve precision.
//   - Java enums are serialized as their `name()` string (default Jackson behavior, also
//     confirmed by `EventResponse.from` / `ReservationResponse.from` calling `.name()`).

// ---------- Enums ----------

export type Role = "USER" | "ADMIN";

export type AuthProvider = "LOCAL" | "GOOGLE";

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type ReservationStatus = "ACTIVE" | "CANCELLED";

// ---------- User / Auth ----------

export interface UserResponse {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  provider: AuthProvider;
  isOrganizer: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface UpdateProfileRequest {
  displayName: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// ---------- Events ----------

export interface EventResponse {
  id: number;
  organizerId: number;
  organizerDisplayName: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  seatsTaken: number;
  price: string;
  coverImageUrl: string | null;
  status: EventStatus;
  cancellationCutoffHours: number;
  createdAt: string;
}

export interface EventListItemResponse {
  id: number;
  title: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  seatsTaken: number;
  price: string;
  coverImageUrl: string | null;
}

// Alias requested by api-courier-cobalt for ergonomic imports.
export type EventListItem = EventListItemResponse;

export interface CreateEventRequest {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  price: string;
  coverImageUrl?: string | null;
  cancellationCutoffHours?: number;
}

// PATCH semantics: every field is optional; backend enforces which fields are
// legal based on the event's current status (see EventService.applyLimited).
export interface UpdateEventRequest {
  title?: string;
  description?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  capacity?: number;
  price?: string;
  coverImageUrl?: string | null;
  cancellationCutoffHours?: number;
}

// ---------- Reservations ----------

export interface ReservationResponse {
  id: number;
  eventId: number;
  eventTitle: string;
  eventStartAt: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface CreateReservationRequest {
  quantity: number;
}

// ---------- Errors ----------

export interface ErrorFieldError {
  field: string;
  error: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  fields?: ErrorFieldError[];
}

// ---------- Pagination ----------

export interface PageableInfo {
  pageNumber: number;
  pageSize: number;
}

export interface Page<T> {
  content: T[];
  pageable: PageableInfo;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  number: number;
  size: number;
  numberOfElements: number;
  empty: boolean;
}
