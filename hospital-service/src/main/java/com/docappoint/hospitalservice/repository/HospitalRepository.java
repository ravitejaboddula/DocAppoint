package com.docappoint.hospitalservice.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import com.docappoint.hospitalservice.model.Hospital;

import java.util.Optional;

public interface HospitalRepository extends MongoRepository<Hospital, String> {
    @Query("{'id': ?0}")
    Optional<Hospital> findByHospitalId(String hospitalId);
}
