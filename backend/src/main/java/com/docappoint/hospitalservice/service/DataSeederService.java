package com.docappoint.hospitalservice.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Service;

import com.docappoint.hospitalservice.model.Doctor;
import com.docappoint.hospitalservice.model.Hospital;
import com.docappoint.hospitalservice.repository.HospitalRepository;

@Service
public class DataSeederService {

    private final HospitalRepository hospitalRepository;
    private final Random random = new Random();

    public DataSeederService(HospitalRepository hospitalRepository) {
        this.hospitalRepository = hospitalRepository;
    }

    private static class Area {
        String name;
        double lat;
        double lng;

        Area(String name, double lat, double lng) {
            this.name = name;
            this.lat = lat;
            this.lng = lng;
        }
    }

    private static final List<Area> AREAS = Arrays.asList(
            new Area("Pocharam Jodimetla", 17.4390, 78.6500),
            new Area("Ghatkesar", 17.4475, 78.6826),
            new Area("Banjara Hills", 17.414, 78.434),
            new Area("Jubilee Hills", 17.432, 78.407),
            new Area("Madhapur", 17.447, 78.392),
            new Area("Gachibowli", 17.440, 78.347),
            new Area("Kukatpally", 17.493, 78.399),
            new Area("Secunderabad", 17.439, 78.498),
            new Area("Kondapur", 17.466, 78.358),
            new Area("Begumpet", 17.444, 78.465),
            new Area("Somajiguda", 17.424, 78.459),
            new Area("Malakpet", 17.375, 78.498),
            new Area("Old City", 17.361, 78.474)
    );

    private static final List<String> PREFIXES = Arrays.asList(
            "Apollo", "CARE", "Yashoda", "KIMS", "Medicover", "Star",
            "Continental", "Omega", "AIG", "Sunshine", "Aster Prime",
            "OMNI", "Gleneagles", "Prathima", "MaxCure", "Citizens",
            "Rainbow", "Fernandez", "Pace", "TX", "Lotus", "SVS", "Ankura"
    );

    private static final List<String> SUFFIXES = Arrays.asList(
            "Hospitals", "Hospital", "Multi-Specialty Center", "Clinic", "Health City", "Medical College & Hospital"
    );

    private static final List<String> SPECIALIZATIONS = Arrays.asList(
            "Cardiologist", "Orthopedic Surgeon", "Neurologist", "General Physician",
            "Paediatrician", "Dermatologist", "ENT Specialist", "Gastroenterologist",
            "Gynecologist", "Pulmonologist", "Dentist", "Psychiatrist", "Oncologist"
    );

    private static final List<String> FIRST_NAMES = Arrays.asList(
            "Aditi", "Rahul", "Neha", "Vivek", "Ananya", "Karan", "Meera", "Sandeep",
            "Priya", "Rohit", "Rajesh", "Suresh", "Sneha", "Arjun", "Vikram", "Anjali",
            "Deepa", "Sanya", "Gaurav", "Nikhil"
    );

    private static final List<String> LAST_NAMES = Arrays.asList(
            "Menon", "Verma", "Kapoor", "Sharma", "Rao", "Desai", "Iyer", "Kulkarni",
            "Shah", "Nair", "Reddy", "Patel", "Singh", "Gupta", "Kumar", "Joshi",
            "Choudhary", "Das", "Bhati"
    );

    private static final List<List<Integer>> AVAILABILITY_PATTERNS = Arrays.asList(
            Arrays.asList(1, 2, 3, 4, 5),       // Mon-Fri
            Arrays.asList(1, 3, 5),             // Mon, Wed, Fri
            Arrays.asList(2, 4, 6),             // Tue, Thu, Sat
            Arrays.asList(1, 2, 4, 5),          // Mon, Tue, Thu, Fri
            Arrays.asList(1, 2, 3, 4, 5, 6),    // Mon-Sat
            Arrays.asList(1, 5),                // Mon, Fri
            Arrays.asList(2, 3, 4)              // Tue, Wed, Thu
    );

    private <T> T getRandomItem(List<T> list) {
        return list.get(random.nextInt(list.size()));
    }

    private Doctor generateDoctor() {
        String name = "Dr. " + getRandomItem(FIRST_NAMES) + " " + getRandomItem(LAST_NAMES);
        String specialization = getRandomItem(SPECIALIZATIONS);
        List<Integer> availableDays = getRandomItem(AVAILABILITY_PATTERNS);
        return new Doctor(name, specialization, availableDays);
    }

    public void seedDatabase() {
        if (hospitalRepository.count() > 0) {
            System.out.println("✅ Hospital data already exists. Skipping seeding.");
            return;
        }

        List<Hospital> hospitals = new ArrayList<>();
        int idCounter = 1001;

        for (Area area : AREAS) {
            // Generate exactly 10 hospitals per area
            for (int i = 0; i < 10; i++) {
                double jitterLat = (random.nextDouble() - 0.5) * 0.02;
                double jitterLng = (random.nextDouble() - 0.5) * 0.02;
                boolean isGovt = random.nextDouble() > 0.85;

                int numDoctors = random.nextInt(7) + 4; // 4 to 10
                List<Doctor> doctors = new ArrayList<>();
                for (int d = 0; d < numDoctors; d++) {
                    doctors.add(generateDoctor());
                }

                String name;
                // Force an SVS Medical College explicitly for the first hospital in Pocharam/Ghatkesar
                if (i == 0 && (area.name.contains("Ghatkesar") || area.name.contains("Pocharam"))) {
                     name = "SVS Medical College & Hospital, " + area.name;
                } else {
                     name = getRandomItem(PREFIXES) + " " + getRandomItem(SUFFIXES) + ", " + area.name;
                }

                Hospital h = new Hospital();
                h.setId(String.format("%04d", idCounter++));
                h.setName(name);
                h.setCity("Hyderabad");
                h.setAddress("Main Road, " + area.name);
                h.setLat(Math.round((area.lat + jitterLat) * 10000.0) / 10000.0);
                h.setLng(Math.round((area.lng + jitterLng) * 10000.0) / 10000.0);
                h.setTag(isGovt ? "Government" : "Private");
                h.setAvailableSlotsLabel((random.nextInt(30) + 5) + " slots tomorrow");
                h.setDoctors(doctors);
                h.setAdminPassword("hospital@123");

                hospitals.add(h);
            }
        }

        hospitalRepository.saveAll(hospitals);
        System.out.println("Seeded " + hospitals.size() + " hospitals evenly distributed across areas directly from Java Spring Boot.");
    }
}
