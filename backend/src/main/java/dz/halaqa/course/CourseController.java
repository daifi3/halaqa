package dz.halaqa.course;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import dz.halaqa.mail.MailService;
import dz.halaqa.room.RoomController;
import dz.halaqa.room.RoomRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Courses", description = "Standing classes with a roster; sessions can be scheduled under them.")
@RestController
@RequestMapping("/api/courses")
public class CourseController {

    public record NewCourseRequest(
            @NotBlank @Size(min = 3, max = 120) String title,
            @NotBlank String subject,
            @Size(max = 500) String description,
            List<@Email String> invitedEmails) {}

    public record InviteRequest(@NotEmpty List<@Email String> emails) {}

    public record JoinRequest(@NotBlank @Size(min = 6, max = 6) String code) {}

    public record CourseDto(String id, String title, String subject, String description, String joinCode,
                             Map<String, String> teacher, List<String> invitedEmails, int memberCount,
                             int roomCount, Instant createdAt) {
        static CourseDto of(Course c, User viewer, long roomCount) {
            boolean owner = c.getTeacher().getId().equals(viewer.getId());
            return new CourseDto(c.getId(), c.getTitle(), c.getSubject(), c.getDescription(),
                    owner ? c.getJoinCode() : "", // only the teacher needs the code
                    Map.of("id", c.getTeacher().getId(), "name", c.getTeacher().getName()),
                    owner ? List.copyOf(c.getInvitedEmails()) : List.of(),
                    c.getMemberIds().size(), (int) roomCount, c.getCreatedAt());
        }
    }

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CourseRepository courses;
    private final RoomRepository rooms;
    private final MailService mail;

    public CourseController(CourseRepository courses, RoomRepository rooms, MailService mail) {
        this.courses = courses;
        this.rooms = rooms;
        this.mail = mail;
    }

    @GetMapping
    public List<CourseDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return courses.findVisibleTo(me.getId(), me.getEmail()).stream()
                .map(c -> CourseDto.of(c, me, rooms.countByCourseId(c.getId())))
                .toList();
    }

    @GetMapping("/{id}")
    public CourseDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = accessible(id, me);
        return CourseDto.of(course, me, rooms.countByCourseId(course.getId()));
    }

    @PostMapping
    @Transactional
    public CourseDto create(@Valid @RequestBody NewCourseRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireTeacher(me);
        var emails = normalizeEmails(req.invitedEmails());
        Course course = new Course(req.title().trim(), req.subject(), req.description(), uniqueCode(), me, emails);
        Course saved = courses.save(course);
        emails.forEach(e -> mail.sendCourseInvite(e, saved));
        return CourseDto.of(saved, me, 0);
    }

    /** Adds more students to an existing course's roster. */
    @PostMapping("/{id}/invite")
    @Transactional
    public CourseDto invite(@PathVariable String id, @Valid @RequestBody InviteRequest req,
                             @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = owned(id, me);
        var emails = normalizeEmails(req.emails());
        course.getInvitedEmails().addAll(emails);
        emails.forEach(e -> mail.sendCourseInvite(e, course));
        return CourseDto.of(course, me, rooms.countByCourseId(course.getId()));
    }

    @PostMapping("/join")
    @Transactional
    public CourseDto join(@Valid @RequestBody JoinRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = courses.findByJoinCode(req.code().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No course found with this code"));
        course.getMemberIds().add(me.getId());
        return CourseDto.of(course, me, rooms.countByCourseId(course.getId()));
    }

    /** Sessions (Rooms) scheduled under this course. */
    @GetMapping("/{id}/rooms")
    public List<RoomController.RoomDto> sessions(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = accessible(id, me);
        return rooms.findByCourseId(course.getId()).stream()
                .filter(r -> r.canAccess(me))
                .map(r -> RoomController.RoomDto.of(r, me))
                .toList();
    }

    /* ---------------------------------------------------------------- */

    private Course accessible(String id, User me) {
        Course course = courses.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        if (!course.canAccess(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not enrolled in this course");
        return course;
    }

    private Course owned(String id, User me) {
        Course course = accessible(id, me);
        if (!course.getTeacher().getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the teacher can do this");
        }
        return course;
    }

    private static void requireTeacher(User me) {
        if (!me.isTeacher()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teachers can create courses");
    }

    private static LinkedHashSet<String> normalizeEmails(List<String> emails) {
        return emails == null ? new LinkedHashSet<>()
                : emails.stream().map(e -> e.trim().toLowerCase()).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String uniqueCode() {
        String code;
        do {
            var sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            code = sb.toString();
        } while (courses.existsByJoinCode(code));
        return code;
    }
}
