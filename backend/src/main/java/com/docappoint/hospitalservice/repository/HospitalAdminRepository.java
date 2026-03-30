package com.docappoint.hospitalservice.repository;

import com.docappoint.hospitalservice.model.HospitalAdmin;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface HospitalAdminRepository extends MongoRepository<HospitalAdmin, String> {
    Optional<HospitalAdmin> findByHospitalId(String hospitalId);
}
