package com.docappoint.hospitalservice.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.docappoint.hospitalservice.service.DataSeederService;

@Component
public class HospitalDataSeeder implements CommandLineRunner {

    private final DataSeederService dataSeederService;

    public HospitalDataSeeder(DataSeederService dataSeederService) {
        this.dataSeederService = dataSeederService;
    }

    @Override
    public void run(String... args) {
        // Always run the real seeder so new IDs / adminPassword are applied
        dataSeederService.seedDatabase();
    }
}
