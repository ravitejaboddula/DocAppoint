package com.docappoint;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
@EnableMongoRepositories(basePackages = "com.docappoint")
public class DocAppointApplication {
    public static void main(String[] args) {
        SpringApplication.run(DocAppointApplication.class, args);
    }
}
