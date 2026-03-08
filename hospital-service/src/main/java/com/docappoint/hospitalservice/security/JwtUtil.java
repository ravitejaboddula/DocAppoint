package com.docappoint.hospitalservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    // Usually this should be a property injected from application.properties
    // For local dev, a generated secure key works.
    private final SecretKey secretKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);

    // 24 hours
    private final long EXPIRATION_TIME = 86400000;

    public String generateToken(String email, String role) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(secretKey)
                .compact();
    }

    public Claims validateTokenAndGetClaims(String token) {
        try {
            return Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (JwtException e) {
            return null; // Invalid token
        }
    }

    public String getEmailFromToken(String token) {
        Claims claims = validateTokenAndGetClaims(token);
        return claims != null ? claims.getSubject() : null;
    }
}
