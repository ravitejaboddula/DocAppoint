package com.docappoint;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication
@EnableMongoRepositories(basePackages = "com.docappoint")
public class DocAppointApplication {
    public static void main(String[] args) {
        SpringApplication.run(DocAppointApplication.class, args);
    }
}
