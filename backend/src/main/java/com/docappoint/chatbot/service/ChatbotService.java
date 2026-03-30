package com.docappoint.chatbot.service;

import com.docappoint.chatbot.dto.ChatbotRequest;
import com.docappoint.chatbot.dto.ChatbotResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ChatbotService {

    private final WebClient geminiWebClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    public ChatbotService(WebClient geminiWebClient, ObjectMapper objectMapper) {
        this.geminiWebClient = geminiWebClient;
        this.objectMapper = objectMapper;
    }

    public ChatbotResponse analyzeSymptoms(ChatbotRequest request) {
        String symptoms = request.getSymptoms();
        log.info("Analyzing symptoms: {}", symptoms);

        try {
            String prompt = buildPrompt(symptoms);
            String geminiResponse = callGeminiApi(prompt);
            return parseGeminiResponse(geminiResponse);
        } catch (Exception e) {
            log.error("Error calling Gemini API: {}", e.getMessage(), e);
            return getFallbackResponse();
        }
    }

    private String buildPrompt(String symptoms) {
        return String.format("""
            You are a medical triage AI. Analyze the symptoms and respond ONLY with a valid JSON object.
            No explanation, no markdown, no code blocks — just the raw JSON.

            Rules:
            - Always give a SPECIFIC specialist, NEVER "General Physician" unless it is truly a minor viral illness
            - Chest pain → Cardiologist
            - Tooth, gum, dental pain → Dentist
            - Joint/bone pain → Orthopedic Surgeon
            - Headache/migraine/seizure → Neurologist
            - Skin/rash/acne → Dermatologist
            - Stomach/gut/nausea → Gastroenterologist
            - Breathing/cough/lung → Pulmonologist
            - Ear/nose/throat/sinus → ENT Specialist
            - Anxiety/depression/sleep → Psychiatrist
            - Eye/vision → Ophthalmologist
            - Urine/kidney → Urologist
            - Women's health → Gynaecologist
            - Diabetes/thyroid → Endocrinologist
            - Child symptoms → Paediatrician

            Symptoms: %s

            Respond with EXACTLY this JSON (fill in the values):
            {"disease":"<specific disease name>","specialist":"<specific doctor type>"}
            """, symptoms);
    }

    private String callGeminiApi(String prompt) {
        Map<String, Object> requestBody = Map.of(
            "contents", List.of(
                Map.of("parts", List.of(Map.of("text", prompt)))
            ),
            "generationConfig", Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 800
            )
        );

        String url = "?key=" + geminiApiKey;

        return geminiWebClient.post()
                .uri(url)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(
                    status -> status.isError(),
                    response -> response.bodyToMono(String.class)
                            .flatMap(errorBody -> Mono.error(new RuntimeException("Gemini API error: " + errorBody)))
                )
                .bodyToMono(String.class)
                .block();
    }

    private ChatbotResponse parseGeminiResponse(String response) {
        try {
            JsonNode rootNode = objectMapper.readTree(response);

            String text = extractGeminiText(rootNode);
            if (text == null || text.isBlank()) {
                log.warn("Gemini response missing text. Raw response: {}", response);
                return getFallbackResponse();
            }

            log.info("Gemini raw text: {}", text);

            // Strip any markdown code fences if present
            String cleaned = text.trim()
                    .replaceAll("(?s)```json\\s*", "")
                    .replaceAll("(?s)```\\s*", "")
                    .trim();

            // Find first { ... } JSON object
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start == -1 || end == -1 || end <= start) {
                log.warn("No JSON found in Gemini text: {}", cleaned);
                return getFallbackResponse();
            }
            String json = cleaned.substring(start, end + 1);

            JsonNode parsed = objectMapper.readTree(json);
            String disease   = parsed.path("disease").asText("").trim();
            String specialist = parsed.path("specialist").asText("").trim();
            String advice    = parsed.path("advice").asText("").trim();

            String normalizedSpecialist = normalizeSpecialist(specialist);

            return ChatbotResponse.builder()
                    .diseasePrediction(disease.isBlank() ? "Needs clinical evaluation" : disease)
                    .recommendedSpecialist(normalizedSpecialist.isBlank() ? "General Physician" : normalizedSpecialist)
                    .advice(advice.isBlank() ? "If symptoms are severe or worsening, seek in-person medical care." : advice)
                    .build();
        } catch (Exception e) {
            log.error("Error parsing Gemini response: {}", e.getMessage());
            return getFallbackResponse();
        }
    }

    private String extractGeminiText(JsonNode rootNode) {
        JsonNode candidates = rootNode.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return null;
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (parts.isArray() && !parts.isEmpty()) {
            return parts.get(0).path("text").asText(null);
        }
        return null;
    }

    private String extractFieldFlexible(String text, String field) {
        // Accept variants like:
        // DISEASE: ..., DISEASE - ..., Disease: ..., **DISEASE:** ...
        // and allow extra whitespace/newlines.
        String upper = text;

        String[] labels = {
                field + ":",
                field + " -",
                field + "-",
                "**" + field + ":**",
                "**" + field + "**:",
                capitalize(field) + ":",
                capitalize(field) + " -",
                capitalize(field) + "-"
        };

        int startIndex = -1;
        String matched = null;
        for (String label : labels) {
            int idx = indexOfIgnoreCase(upper, label);
            if (idx != -1) {
                startIndex = idx + label.length();
                matched = label;
                break;
            }
        }
        if (startIndex == -1) {
            return null;
        }

        int endIndex = text.length();
        String[] nextFields = {"DISEASE", "SPECIALIST", "ADVICE"};
        for (String nextField : nextFields) {
            if (!nextField.equalsIgnoreCase(field)) {
                for (String nextLabel : new String[]{nextField + ":", nextField + " -", nextField + "-", "**" + nextField + ":**", capitalize(nextField) + ":"}) {
                    int nextIndex = indexOfIgnoreCase(text, nextLabel, startIndex);
                    if (nextIndex != -1 && nextIndex < endIndex) {
                        endIndex = nextIndex;
                    }
                }
            }
        }

        String raw = text.substring(startIndex, endIndex).trim();
        raw = raw.replaceAll("^[\\-*•]+\\s*", "");
        raw = raw.replaceAll("^\\[|\\]$", "");
        if (raw.isBlank()) {
            log.warn("Parsed blank field {} using label {}", field, matched);
            return null;
        }
        return raw;
    }

    private String normalizeSpecialist(String specialist) {
        if (specialist == null) {
            return null;
        }
        String s = specialist.trim();
        // If Gemini returns something like "General Physician" despite instructions, convert to more useful default.
        if (s.equalsIgnoreCase("General Physician") || s.equalsIgnoreCase("General Practitioner") || s.equalsIgnoreCase("GP")) {
            return "Internal Medicine";
        }
        return s;
    }

    private int indexOfIgnoreCase(String text, String needle) {
        return text.toLowerCase().indexOf(needle.toLowerCase());
    }

    private int indexOfIgnoreCase(String text, String needle, int fromIndex) {
        return text.toLowerCase().indexOf(needle.toLowerCase(), fromIndex);
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        String lower = s.toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private ChatbotResponse getFallbackResponse() {
        return ChatbotResponse.builder()
                .diseasePrediction("Unable to determine")
                .recommendedSpecialist("General Physician")
                .advice("Please consult a doctor for proper diagnosis and treatment.")
                .build();
    }
}
