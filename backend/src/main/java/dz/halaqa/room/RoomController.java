package dz.halaqa.room;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.User;
import dz.halaqa.course.Course;
import dz.halaqa.course.CourseRepository;
import dz.halaqa.livekit.LiveKitService;
import dz.halaqa.mail.MailService;
import dz.halaqa.recording.Recording;
import dz.halaqa.recording.RecordingRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Rooms", description = "Live sessions: scheduling, invitations and RSVPs, LiveKit tokens, screen-share permissions and recording.")
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    public record NewRoomRequest(
            @NotBlank @Size(min = 3, max = 120) String title,
            @NotBlank String subject,
            @NotNull Instant startsAt,
            @Min(15) @Max(240) int durationMin,
            List<@Email String> invitedEmails,
            /** Optional — schedules this session under a standing course, inheriting its roster. */
            String courseId) {}

    public record JoinRequest(@NotBlank @Size(min = 6, max = 6) String code) {}

    public record RsvpRequest(@NotNull Room.Rsvp response) {}

    public record ScreenShareGrantRequest(@NotBlank String userId, boolean allow) {}

    public record ScreenSharePolicyRequest(boolean open) {}

    public record MuteRequest(@NotBlank String userId) {}

    public enum StudentSource { invite, course, code }

    /** One row of a session's guest list. name/userId are null until the student signs up. */
    public record StudentDto(String email, String name, String userId, Room.Rsvp status, StudentSource source) {}

    public record RoomDto(String id, String title, String subject, Instant startsAt, int durationMin, String joinCode,
                          Map<String, String> teacher, List<String> invitedEmails, Room.Status status, boolean isRecording,
                          String courseId, String courseTitle, Room.Rsvp myRsvp) {
        public static RoomDto of(Room r, User viewer) {
            boolean owner = r.getTeacher().getId().equals(viewer.getId());
            Course course = r.getCourse();
            return new RoomDto(r.getId(), r.getTitle(), r.getSubject(), r.getStartsAt(), r.getDurationMin(),
                    owner ? r.getJoinCode() : "", // only the teacher needs the code
                    Map.of("id", r.getTeacher().getId(), "name", r.getTeacher().getName()),
                    owner ? List.copyOf(r.getInvitedEmails()) : List.of(),
                    r.getStatus(), r.getActiveEgressId() != null,
                    course != null ? course.getId() : null,
                    course != null ? course.getTitle() : null,
                    owner ? null : r.rsvpOf(viewer.getEmail()));
        }
    }

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RoomRepository rooms;
    private final CourseRepository courses;
    private final LiveKitService livekit;
    private final RecordingRepository recordings;
    private final MailService mail;
    private final AuthRepositories.Users users;

    public RoomController(RoomRepository rooms, CourseRepository courses, LiveKitService livekit,
                           RecordingRepository recordings, MailService mail, AuthRepositories.Users users) {
        this.rooms = rooms;
        this.courses = courses;
        this.livekit = livekit;
        this.recordings = recordings;
        this.mail = mail;
        this.users = users;
    }

    @GetMapping
    public List<RoomDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return rooms.findVisibleTo(me.getId(), me.getEmail()).stream().map(r -> RoomDto.of(r, me)).toList();
    }

    @GetMapping("/{id}")
    public RoomDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return RoomDto.of(accessible(id, me), me);
    }

    @PostMapping
    @Transactional
    public RoomDto create(@Valid @RequestBody NewRoomRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        requireTeacher(me);
        Course course = null;
        if (req.courseId() != null && !req.courseId().isBlank()) {
            course = courses.findById(req.courseId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
            if (!course.getTeacher().getId().equals(me.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the course teacher can schedule its sessions");
            }
        }
        var emails = req.invitedEmails() == null ? new LinkedHashSet<String>()
                : req.invitedEmails().stream().map(e -> e.trim().toLowerCase()).collect(Collectors.toCollection(LinkedHashSet::new));
        Room room = new Room(req.title().trim(), req.subject(), req.startsAt(), req.durationMin(), uniqueCode(), me, emails);
        room.setCourse(course);
        Room saved = rooms.save(room);
        emails.forEach(e -> mail.sendRoomInvite(e, saved));
        return RoomDto.of(saved, me);
    }

    @PostMapping("/join")
    @Transactional
    public RoomDto join(@Valid @RequestBody JoinRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = rooms.findByJoinCode(req.code().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No class found with this code"));
        if (room.getStatus() == Room.Status.ended) throw new ResponseStatusException(HttpStatus.GONE, "This class has ended");
        if (!room.getTeacher().getId().equals(me.getId())) {
            room.getMemberIds().add(me.getId());
            room.getRsvps().put(me.getEmail().toLowerCase(), Room.Rsvp.accepted);
        }
        return RoomDto.of(room, me);
    }

    /** A student accepts or declines their invite to this session. */
    @PostMapping("/{id}/rsvp")
    @Transactional
    public RoomDto rsvp(@PathVariable String id, @Valid @RequestBody RsvpRequest req,
                        @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = accessible(id, me);
        if (room.getTeacher().getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Teachers don't RSVP to their own class");
        }
        if (req.response() == Room.Rsvp.pending) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Answer with accepted or declined");
        }
        room.getRsvps().put(me.getEmail().toLowerCase(), req.response());
        return RoomDto.of(room, me);
    }

    /** Everyone who can attend this session, with their RSVP — teacher only. */
    @GetMapping("/{id}/students")
    public List<StudentDto> students(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        Course course = room.getCourse();

        // Members are stored by user id; resolve them to emails so every row is keyed the same way.
        var memberIds = new LinkedHashSet<>(room.getMemberIds());
        if (course != null) memberIds.addAll(course.getMemberIds());
        Map<String, User> byId = users.findAllById(memberIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        // First source wins, so a student invited directly isn't relabelled by the course roster.
        var sources = new LinkedHashMap<String, StudentSource>();
        room.getInvitedEmails().forEach(e -> sources.putIfAbsent(e, StudentSource.invite));
        if (course != null) {
            course.getInvitedEmails().forEach(e -> sources.putIfAbsent(e, StudentSource.course));
            course.getMemberIds().stream().map(byId::get).filter(u -> u != null)
                    .forEach(u -> sources.putIfAbsent(u.getEmail().toLowerCase(), StudentSource.course));
        }
        room.getMemberIds().stream().map(byId::get).filter(u -> u != null)
                .forEach(u -> sources.putIfAbsent(u.getEmail().toLowerCase(), StudentSource.code));

        Map<String, User> byEmail = new HashMap<>();
        users.findByEmailIn(sources.keySet()).forEach(u -> byEmail.put(u.getEmail().toLowerCase(), u));

        return sources.entrySet().stream().map(e -> {
            User u = byEmail.get(e.getKey());
            return new StudentDto(e.getKey(), u != null ? u.getName() : null, u != null ? u.getId() : null,
                    room.rsvpOf(e.getKey()), e.getValue());
        }).toList();
    }

    @PostMapping("/{id}/start")
    @Transactional
    public RoomDto start(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        room.setStatus(Room.Status.live);
        return RoomDto.of(room, me);
    }

    @PostMapping("/{id}/end")
    @Transactional
    public RoomDto end(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        if (room.getActiveEgressId() != null) {
            livekit.stopRecording(room.getActiveEgressId());
            room.setActiveEgressId(null);
        }
        room.setStatus(Room.Status.ended);
        livekit.closeRoom(room.livekitName()); // disconnects everyone
        return RoomDto.of(room, me);
    }

    /** Issues a LiveKit token for this user in this room. */
    @PostMapping("/{id}/token")
    public Map<String, String> token(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = accessible(id, me);
        if (room.getStatus() == Room.Status.ended) throw new ResponseStatusException(HttpStatus.GONE, "This class has ended");
        if (!me.isTeacher() && room.getStatus() != Room.Status.live) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The teacher hasn't started the class yet");
        }
        return Map.of("serverUrl", livekit.wsUrl(), "token", livekit.createToken(room, me));
    }

    /** Teacher allows (or stops) one student sharing their screen. */
    @PostMapping("/{id}/screen-share/grant")
    @Transactional
    public Map<String, Boolean> grantScreenShare(@PathVariable String id, @Valid @RequestBody ScreenShareGrantRequest req,
                                                 @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        if (req.userId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can always share your own screen");
        if (req.allow()) room.getScreenShareGrants().add(req.userId());
        else room.getScreenShareGrants().remove(req.userId());
        // Applied to the live call as-is: stopping a student cuts them off even when the room is open.
        livekit.setScreenShare(room, req.userId(), req.allow());
        return Map.of("allowed", req.allow());
    }

    /** Teacher lets every student share without asking — or takes that back from everyone. */
    @PostMapping("/{id}/screen-share/policy")
    @Transactional
    public Map<String, Boolean> screenSharePolicy(@PathVariable String id, @RequestBody ScreenSharePolicyRequest req,
                                                  @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        room.setScreenShareOpen(req.open());
        if (!req.open()) room.getScreenShareGrants().clear();
        for (String identity : livekit.participants(room)) {
            if (!identity.equals(me.getId())) livekit.setScreenShare(room, identity, req.open());
        }
        return Map.of("open", req.open());
    }

    /** Teacher mutes one student's microphone. The student can unmute themselves. */
    @PostMapping("/{id}/mute")
    public Map<String, Boolean> mute(@PathVariable String id, @Valid @RequestBody MuteRequest req,
                                     @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        if (req.userId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use your own microphone button");
        return Map.of("muted", livekit.muteMicrophone(room, req.userId()));
    }

    /** Teacher mutes every student at once. Returns how many microphones were turned off. */
    @PostMapping("/{id}/mute-all")
    public Map<String, Integer> muteAll(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return Map.of("muted", livekit.muteStudents(owned(id, me)));
    }

    @PostMapping("/{id}/recording/start")
    @Transactional
    public RoomDto startRecording(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        if (room.getActiveEgressId() == null) {
            String egressId = livekit.startRecording(room);
            room.setActiveEgressId(egressId);
            recordings.save(new Recording(room, egressId)); // "processing" until the webhook says it's ready
        }
        return RoomDto.of(room, me);
    }

    @PostMapping("/{id}/recording/stop")
    @Transactional
    public RoomDto stopRecording(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Room room = owned(id, me);
        if (room.getActiveEgressId() != null) {
            livekit.stopRecording(room.getActiveEgressId());
            room.setActiveEgressId(null);
        }
        return RoomDto.of(room, me);
    }

    /* ---------------------------------------------------------------- */

    private Room accessible(String id, User me) {
        Room room = rooms.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));
        if (!room.canAccess(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not invited to this class");
        return room;
    }

    private Room owned(String id, User me) {
        Room room = accessible(id, me);
        if (!room.getTeacher().getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the teacher can do this");
        }
        return room;
    }

    private static void requireTeacher(User me) {
        if (!me.isTeacher()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only teachers can reserve rooms");
    }

    private String uniqueCode() {
        String code;
        do {
            var sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            code = sb.toString();
        } while (rooms.existsByJoinCode(code));
        return code;
    }
}
