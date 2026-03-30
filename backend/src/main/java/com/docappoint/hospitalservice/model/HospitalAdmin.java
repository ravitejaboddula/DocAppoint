package com.docappoint.hospitalservice.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

@Document(collection = "hospital_admins")
public class HospitalAdmin {

    @Id
    private String id;

    @Indexed(unique = true)
    private String hospitalId;   // e.g. "1001" — links to Hospital.id

    private String password;     // BCrypt-hashed

    private boolean active = true;

    public HospitalAdmin() {}

    public HospitalAdmin(String hospitalId, String password) {
        this.hospitalId = hospitalId;
        this.password = password;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHospitalId() { return hospitalId; }
    public void setHospitalId(String hospitalId) { this.hospitalId = hospitalId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
