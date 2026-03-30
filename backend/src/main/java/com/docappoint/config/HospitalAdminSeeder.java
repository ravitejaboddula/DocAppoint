package com.docappoint.config;

import com.docappoint.hospitalservice.model.HospitalAdmin;
import com.docappoint.hospitalservice.repository.HospitalAdminRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
public class HospitalAdminSeeder {

    /**
     * Seeds the `hospital_admins` collection with login credentials for the
     * 10 Pocharam Jodimetla hospitals (IDs 1001-1010) on every startup.
     * Passwords are BCrypt-hashed before storage.
     *
     * Default password for ALL hospitals: hospital@123
     */
    @Bean
    public CommandLineRunner seedHospitalAdmins(
            HospitalAdminRepository hospitalAdminRepository,
            PasswordEncoder passwordEncoder) {

        return args -> {
            if (hospitalAdminRepository.count() > 0) {
                System.out.println("✅ Hospital admins already exist. Skipping seeding.");
                return;
            }

            String defaultPassword = passwordEncoder.encode("hospital@123");

            // Pocharam Jodimetla hospitals: IDs 1001 – 1010
            List<HospitalAdmin> admins = List.of(
                new HospitalAdmin("1001", defaultPassword),
                new HospitalAdmin("1002", defaultPassword),
                new HospitalAdmin("1003", defaultPassword),
                new HospitalAdmin("1004", defaultPassword),
                new HospitalAdmin("1005", defaultPassword),
                new HospitalAdmin("1006", defaultPassword),
                new HospitalAdmin("1007", defaultPassword),
                new HospitalAdmin("1008", defaultPassword),
                new HospitalAdmin("1009", defaultPassword),
                new HospitalAdmin("1010", defaultPassword)
            );

            hospitalAdminRepository.saveAll(admins);
            System.out.println("✅ Seeded " + admins.size() + " hospital admin credentials into 'hospital_admins' collection.");
        };
    }
}
