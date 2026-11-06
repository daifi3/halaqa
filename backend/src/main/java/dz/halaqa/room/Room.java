package dz.halaqa.room;

import dz.halaqa.auth.User;
import dz.halaqa.course.Course;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "rooms")
public class Room {
    public enum Status { scheduled, live, ended }

    /** A student's answer to the invite. Absent from {@link #rsvps} means pending. */
    public enum Rsvp { pending, accepted, declined }

    @Id
    private String id = UUID.randomUUID().toString();

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false)
    private Instant startsAt;

    private int durationMin;

    @Column(nullable = false, unique = true, length = 6)
    private String joinCode;

    @ManyToOne(optional = false)
    private User teacher;

    /** Standing course this session belongs to, if any — its roster has access too. */
    @ManyToOne
    private Course course;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_invites")
    private Set<String> invitedEmails = new LinkedHashSet<>();

    /** Students who joined with the code. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_members")
    private Set<String> memberIds = new LinkedHashSet<>();

    /** RSVPs keyed by lower-cased student email. Joining with the code records "accepted". */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_rsvps")
    @MapKeyColumn(name = "email")
    @Column(name = "response")
    @Enumerated(EnumType.STRING)
    private Map<String, Rsvp> rsvps = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    private Status status = Status.scheduled;

    /** Non-null while LiveKit Egress is recording this room. */
    private String activeEgressId;

    /** When true, every student may share their screen without asking. Nullable so existing rows migrate. */
    private Boolean screenShareOpen;

    /** Students (by user id) the teacher allowed to share their screen. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "room_screen_grants")
    private Set<String> screenShareGrants = new LinkedHashSet<>();

    protected Room() {}

    public Room(String title, String subject, Instant startsAt, int durationMin, String joinCode, User teacher, Set<String> invitedEmails) {
        this.title = title;
        this.subject = subject;
        this.startsAt = startsAt;
        this.durationMin = durationMin;
        this.joinCode = joinCode;
        this.teacher = teacher;
        this.invitedEmails.addAll(invitedEmails);
    }

    public boolean canAccess(User u) {
        boolean direct = teacher.getId().equals(u.getId())
                || memberIds.contains(u.getId())
                || invitedEmails.contains(u.getEmail().toLowerCase());
        return direct || (course != null && course.canAccess(u));
    }

    /** LiveKit room name — stable and unique. */
    public String livekitName() { return "room-" + id; }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getSubject() { return subject; }
    public Instant getStartsAt() { return startsAt; }
    public int getDurationMin() { return durationMin; }
    public String getJoinCode() { return joinCode; }
    public User getTeacher() { return teacher; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public Set<String> getInvitedEmails() { return invitedEmails; }
    public Set<String> getMemberIds() { return memberIds; }
    public Map<String, Rsvp> getRsvps() { return rsvps; }
    public Rsvp rsvpOf(String email) { return rsvps.getOrDefault(email.toLowerCase(), Rsvp.pending); }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getActiveEgressId() { return activeEgressId; }
    public void setActiveEgressId(String activeEgressId) { this.activeEgressId = activeEgressId; }
    public boolean isScreenShareOpen() { return Boolean.TRUE.equals(screenShareOpen); }
    public void setScreenShareOpen(boolean open) { this.screenShareOpen = open; }
    public Set<String> getScreenShareGrants() { return screenShareGrants; }

    /** The teacher always can; a student only when the room is open or they were allowed. */
    public boolean canShareScreen(User u) {
        return teacher.getId().equals(u.getId()) || isScreenShareOpen() || screenShareGrants.contains(u.getId());
    }
}
