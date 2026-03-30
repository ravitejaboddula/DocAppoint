package com.docappoint.hospitalservice.controller;

import com.docappoint.hospitalservice.model.Booking;
import com.docappoint.hospitalservice.repository.BookingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingRepository bookingRepository;

    public BookingController(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    /**
     * POST /api/bookings
     * Save a new appointment booking made by a user.
     */
    @PostMapping
    public ResponseEntity<Booking> createBooking(@RequestBody Booking booking) {
        booking.setStatus("Pending");
        booking.setBookedAt(LocalDateTime.now());
        Booking saved = bookingRepository.save(booking);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * GET /api/bookings/hospital/{hospitalId}
     * Fetch all bookings for a specific hospital (for hospital admin dashboard).
     */
    @GetMapping("/hospital/{hospitalId}")
    public ResponseEntity<List<Booking>> getBookingsByHospital(@PathVariable String hospitalId) {
        List<Booking> bookings = bookingRepository.findByHospitalIdOrderByBookedAtDesc(hospitalId);
        return ResponseEntity.ok(bookings);
    }

    /**
     * PATCH /api/bookings/{bookingId}/status
     * Update booking status (e.g., "Completed", "Cancelled").
     */
    @PatchMapping("/{bookingId}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable String bookingId,
            @RequestBody java.util.Map<String, String> body) {
        return bookingRepository.findById(bookingId).map(booking -> {
            booking.setStatus(body.getOrDefault("status", booking.getStatus()));
            bookingRepository.save(booking);
            return ResponseEntity.ok(booking);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/bookings/{bookingId}
     * Delete a booking entirely from the database.
     */
    @DeleteMapping("/{bookingId}")
    public ResponseEntity<Void> deleteBooking(@PathVariable String bookingId) {
        if (!bookingRepository.existsById(bookingId)) {
            return ResponseEntity.notFound().build();
        }
        bookingRepository.deleteById(bookingId);
        return ResponseEntity.noContent().build();
    }
}
