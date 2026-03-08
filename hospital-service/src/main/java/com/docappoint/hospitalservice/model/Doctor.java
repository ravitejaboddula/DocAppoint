package com.docappoint.hospitalservice.model;

public class Doctor {

    private String name;
    private String specialization;
    private java.util.List<Integer> availableDays;

    public Doctor() {
    }

    public Doctor(String name, String specialization) {
        this.name = name;
        this.specialization = specialization;
    }

    public Doctor(String name, String specialization, java.util.List<Integer> availableDays) {
        this.name = name;
        this.specialization = specialization;
        this.availableDays = availableDays;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public java.util.List<Integer> getAvailableDays() {
        return availableDays;
    }

    public void setAvailableDays(java.util.List<Integer> availableDays) {
        this.availableDays = availableDays;
    }
}
