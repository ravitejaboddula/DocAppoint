package com.docappoint.hospitalservice.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.docappoint.hospitalservice.model.Doctor;
import com.docappoint.hospitalservice.model.Hospital;
import com.docappoint.hospitalservice.repository.HospitalRepository;
import com.docappoint.hospitalservice.service.DataSeederService;

@RestController
@RequestMapping("/api/hospitals")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"})
public class HospitalController {

    private final HospitalRepository hospitalRepository;
    private final DataSeederService dataSeederService;

    public HospitalController(HospitalRepository hospitalRepository, DataSeederService dataSeederService) {
        this.hospitalRepository = hospitalRepository;
        this.dataSeederService = dataSeederService;
    }

    @GetMapping
    public List<Hospital> getAllHospitals() {
        return hospitalRepository.findAll();
    }

    @PostMapping("/seed")
    public String seedHospitals(@RequestBody List<Hospital> hospitals) {
        hospitalRepository.deleteAll();
        hospitalRepository.saveAll(hospitals);
        return "Seeded " + hospitals.size() + " hospitals successfully!";
    }

    @GetMapping("/generate")
    public String generateHospitals() {
        dataSeederService.seedDatabase();
        return "Generated and seeded 100 hospitals successfully!";
    }

    @DeleteMapping
    public String deleteAllHospitals() {
        hospitalRepository.deleteAll();
        return "Deleted all hospitals";
    }

    @GetMapping("/demo")
    public List<Map<String, Object>> getDemoHospitals() {
        List<Hospital> top = hospitalRepository.findAll(PageRequest.of(0, 3)).getContent();
        return top.stream()
                .map(h -> {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("id", h.getId() != null ? h.getId() : h.getMongoId());
                    dto.put("name", h.getName());
                    dto.put("distance", h.getDistance() != null ? h.getDistance() : "2.5 km");
                    dto.put("slots", h.getAvailableSlotsLabel());
                    dto.put("tag", h.getTag() != null ? h.getTag() : "General");
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /**
     * PATCH /api/hospitals/{hospitalId}/doctors/{doctorIndex}/availability
     * Updates a specific doctor's availableDays in the MongoDB hospitals collection.
     * doctorIndex is 0-based index in the hospital's doctors array.
     * Body: { "availableDays": [1, 3, 5] }
     */
    @PatchMapping("/{hospitalId}/doctors/{doctorIndex}/availability")
    public ResponseEntity<?> updateDoctorAvailability(
            @PathVariable String hospitalId,
            @PathVariable int doctorIndex,
            @RequestBody Map<String, Object> payload) {

        Optional<Hospital> hospitalOpt = hospitalRepository.findByHospitalId(hospitalId);
        if (hospitalOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Hospital hospital = hospitalOpt.get();
        List<Doctor> doctors = hospital.getDoctors();

        if (doctorIndex < 0 || doctorIndex >= doctors.size()) {
            return ResponseEntity.badRequest().body("Invalid doctor index");
        }

        Doctor doctor = doctors.get(doctorIndex);

        if (payload.containsKey("availableDays")) {
            @SuppressWarnings("unchecked")
            List<Integer> days = (List<Integer>) payload.get("availableDays");
            doctor.setAvailableDays(days);
        }

        doctors.set(doctorIndex, doctor);
        hospital.setDoctors(doctors);
        hospitalRepository.save(hospital);

        return ResponseEntity.ok(Map.of(
            "message", "Doctor availability updated successfully",
            "doctorName", doctor.getName(),
            "availableDays", doctor.getAvailableDays()
        ));
    }
}
