package dz.halaqa.admin;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** The landing page's "Request a demo" form. Public: whoever sends it doesn't have an account yet. */
@Tag(name = "Demo requests", description = "Teachers and schools asking to join Halaqa (public).")
@RestController
@RequestMapping("/api/demo-requests")
public class DemoRequestController {

    private static final Logger log = LoggerFactory.getLogger(DemoRequestController.class);
    /** One request per email in this window; a second one just gets the same thank-you. */
    private static final Duration REPEAT_WINDOW = Duration.ofHours(1);

    /** website: a hidden field people never see. Bots fill every field, so a value there means spam. */
    public record NewDemoRequest(
            @NotBlank @Size(min = 2, max = 120) String name,
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 40) String phone,
            @Size(max = 160) String organization,
            @Size(max = 1000) String message,
            String website) {}

    private final DemoRequestRepository requests;

    public DemoRequestController(DemoRequestRepository requests) {
        this.requests = requests;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> create(@Valid @RequestBody NewDemoRequest req) {
        // Spam and repeats get the same answer as a real request, so there's nothing to probe.
        if (req.website() != null && !req.website().isBlank()) return Map.of("status", "received");
        String email = req.email().trim().toLowerCase();
        if (requests.existsByEmailIgnoreCaseAndCreatedAtAfter(email, Instant.now().minus(REPEAT_WINDOW))) {
            return Map.of("status", "received");
        }
        requests.save(new DemoRequest(req.name().trim(), email, blankToNull(req.phone()),
                blankToNull(req.organization()), blankToNull(req.message())));
        log.info("New demo request from {}", email);
        return Map.of("status", "received");
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
