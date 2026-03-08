package com.docappoint.hospitalservice.repository;

import com.docappoint.hospitalservice.model.Booking;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface BookingRepository extends MongoRepository<Booking, String> {
    List<Booking> findByHospitalIdOrderByBookedAtDesc(String hospitalId);
    List<Booking> findByDoctorNameAndHospitalId(String doctorName, String hospitalId);
}
