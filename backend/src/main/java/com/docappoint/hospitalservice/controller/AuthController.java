package com.docappoint.hospitalservice.controller;

import com.docappoint.hospitalservice.model.User;
import com.docappoint.hospitalservice.model.Hospital;
import com.docappoint.hospitalservice.model.HospitalAdmin;
import com.docappoint.hospitalservice.repository.UserRepository;
import com.docappoint.hospitalservice.repository.HospitalRepository;
import com.docappoint.hospitalservice.repository.HospitalAdminRepository;
import com.docappoint.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final HospitalRepository hospitalRepository;
    private final HospitalAdminRepository hospitalAdminRepository;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            HospitalRepository hospitalRepository,
            HospitalAdminRepository hospitalAdminRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.hospitalRepository = hospitalRepository;
        this.hospitalAdminRepository = hospitalAdminRepository;
    }

    // ── User Registration ───────────────────────────────────────────────────
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Email is already taken");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole("USER");
        userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body("User registered successfully");
    }

    // ── User Login ──────────────────────────────────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (passwordEncoder.matches(password, user.getPassword())) {
                String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
                Map<String, Object> response = new HashMap<>();
                response.put("token", token);
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("id", user.getId());
                userMap.put("name", user.getName());
                userMap.put("email", user.getEmail());
                userMap.put("role", user.getRole());
                userMap.put("phone", user.getPhone() != null ? user.getPhone() : "");
                response.put("user", userMap);
                return ResponseEntity.ok(response);
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
    }

    // ── Hospital Admin Login ────────────────────────────────────────────────
    // Credentials verified against the dedicated `hospital_admins` collection
    @PostMapping("/hospital-login")
    public ResponseEntity<?> hospitalLogin(@RequestBody Map<String, String> credentials) {
        String hospitalId = credentials.get("hospitalId");
        String password   = credentials.get("password");

        // Step 1 — look up credentials in hospital_admins collection
        Optional<HospitalAdmin> adminOpt = hospitalAdminRepository.findByHospitalId(hospitalId);
        if (adminOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid hospital ID or password");
        }

        HospitalAdmin admin = adminOpt.get();

        // Step 2 — BCrypt verify
        if (!passwordEncoder.matches(password, admin.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid hospital ID or password");
        }

        if (!admin.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Hospital account is inactive");
        }

        // Step 3 — fetch hospital details from hospitals collection
        Optional<Hospital> hospitalOpt = hospitalRepository.findByHospitalId(hospitalId);
        if (hospitalOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Hospital not found");
        }
        Hospital hospital = hospitalOpt.get();

        // Step 4 — return hospital data (no password returned)
        Map<String, Object> response = new HashMap<>();
        response.put("id", hospital.getId());
        response.put("hospitalId", hospital.getId());
        response.put("name", hospital.getName());
        response.put("address", hospital.getAddress());
        response.put("tag", hospital.getTag());
        response.put("doctors", hospital.getDoctors());
        return ResponseEntity.ok(response);
    }
}
