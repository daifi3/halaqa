package dz.halaqa.student;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.User;
import dz.halaqa.course.Course;
import dz.halaqa.course.CourseRepository;
import dz.halaqa.room.Room;
import dz.halaqa.room.RoomRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Students", description = "Everyone a teacher teaches, across all their courses and sessions.")
@RestController
@RequestMapping("/api/students")
public class StudentController {

    public record CourseRef(String id, String title) {}

    /** One student of the teacher. name/userId/avatarUrl are null until they sign up. */
    public record StudentDto(String email, String name, String userId, String avatarUrl,
                             List<CourseRef> courses, int sessionCount) {}

    private final CourseRepository courses;
    private final RoomRepository rooms;
    private final AuthRepositories.Users users;

    public StudentController(CourseRepository courses, RoomRepository rooms, AuthRepositories.Users users) {
        this.courses = courses;
        this.rooms = rooms;
        this.users = users;
    }

    /** The teacher's students: course rosters, code-joined members and anyone invited to their sessions. */
    @GetMapping
    @Transactional(readOnly = true)
    public List<StudentDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        if (!me.isTeacher()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teachers have a student list");

        List<Course> myCourses = courses.findByTeacherIdOrderByCreatedAtDesc(me.getId());
        List<Room> myRooms = rooms.findByTeacherId(me.getId());

        // Members are stored by user id; resolve them to emails so every row is keyed the same way.
        Set<String> memberIds = new HashSet<>();
        myCourses.forEach(c -> memberIds.addAll(c.getMemberIds()));
        myRooms.forEach(r -> memberIds.addAll(r.getMemberIds()));
        Map<String, User> byId = users.findAllById(memberIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Function<Set<String>, List<String>> emailsOf = ids -> ids.stream().map(byId::get)
                .filter(u -> u != null).map(u -> u.getEmail().toLowerCase()).toList();

        Map<String, LinkedHashSet<String>> courseIdsByEmail = new LinkedHashMap<>();
        Map<String, Set<String>> roomIdsByEmail = new HashMap<>();

        for (Course c : myCourses) {
            List<String> emails = new ArrayList<>(c.getInvitedEmails());
            emails.addAll(emailsOf.apply(c.getMemberIds()));
            emails.forEach(e -> courseIdsByEmail.computeIfAbsent(e.toLowerCase(), k -> new LinkedHashSet<>()).add(c.getId()));
        }
        for (Room r : myRooms) {
            List<String> emails = new ArrayList<>(r.getInvitedEmails());
            emails.addAll(emailsOf.apply(r.getMemberIds()));
            Course c = r.getCourse();
            if (c != null) {
                emails.addAll(c.getInvitedEmails());
                emails.addAll(emailsOf.apply(c.getMemberIds()));
            }
            emails.forEach(e -> {
                String key = e.toLowerCase();
                courseIdsByEmail.computeIfAbsent(key, k -> new LinkedHashSet<>());
                roomIdsByEmail.computeIfAbsent(key, k -> new HashSet<>()).add(r.getId());
            });
        }
        courseIdsByEmail.remove(me.getEmail().toLowerCase());

        Map<String, User> byEmail = new HashMap<>();
        users.findByEmailIn(courseIdsByEmail.keySet()).forEach(u -> byEmail.put(u.getEmail().toLowerCase(), u));
        Map<String, Course> courseById = myCourses.stream().collect(Collectors.toMap(Course::getId, Function.identity()));

        return courseIdsByEmail.entrySet().stream().map(e -> {
            User u = byEmail.get(e.getKey());
            List<CourseRef> refs = e.getValue().stream().map(courseById::get)
                    .map(c -> new CourseRef(c.getId(), c.getTitle())).toList();
            return new StudentDto(e.getKey(), u != null ? u.getName() : null, u != null ? u.getId() : null,
                    u != null ? u.getAvatarUrl() : null, refs, roomIdsByEmail.getOrDefault(e.getKey(), Set.of()).size());
        }).sorted(Comparator.comparing((StudentDto s) -> s.name() == null)
                .thenComparing(s -> (s.name() != null ? s.name() : s.email()).toLowerCase()))
                .toList();
    }
}
