package com.docappoint.config;

import com.docappoint.security.JwtFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 1. Disable CSRF (not needed for stateless REST APIs)
            .csrf(csrf -> csrf.disable())
            
            // 2. Enable CORS (config provided in WebConfig.java)
            .cors(cors -> {})
            
            // 3. Set Session to Stateless (no JSESSIONID cookie)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // 4. Set endpoint permissions
            .authorizeHttpRequests(auth -> auth
                // Allow all for testing - permitAll() ignores security for these paths
                .requestMatchers("/api/auth/**", "/api/hospitals/**", "/api/bookings/**", "/api/chatbot/**", "/health", "/actuator/**").permitAll()
                // All other requests require authentication
                .anyRequest().authenticated()
            );

        // 5. Add JWT Filter before the standard UsernamePasswordAuthenticationFilter
        http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
