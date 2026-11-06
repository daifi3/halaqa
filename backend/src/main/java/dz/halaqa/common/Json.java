package dz.halaqa.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Tiny JSON helper for the few entity fields stored as JSON text (an exam's
 * questions, an attempt's answers) — data that's always read and written as a
 * whole, so separate tables would only add joins.
 */
public final class Json {
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    private Json() {}

    public static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise value", e);
        }
    }

    public static <T> T read(String json, TypeReference<T> type) {
        try {
            return MAPPER.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt JSON column", e);
        }
    }
}
