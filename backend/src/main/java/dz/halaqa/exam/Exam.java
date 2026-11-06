package dz.halaqa.exam;

import com.fasterxml.jackson.core.type.TypeReference;
import dz.halaqa.auth.User;
import dz.halaqa.common.Json;
import dz.halaqa.course.Course;
import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A timed exam on a course. Students start it inside [opensAt, closesAt) and get one attempt. */
@Entity
@Table(name = "exams")
public class Exam {
    private static final TypeReference<List<ExamQuestion>> QUESTIONS = new TypeReference<>() {};

    @Id
    private String id = UUID.randomUUID().toString();

    @ManyToOne(optional = false)
    private Course course;

    @ManyToOne(optional = false)
    private User teacher;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 4000)
    private String instructions;

    @Column(nullable = false)
    private int durationMin;

    @Column(nullable = false)
    private Instant opensAt;

    @Column(nullable = false)
    private Instant closesAt;

    /** Whether students see their score and the answer key once they've finished. */
    @Column(nullable = false)
    private boolean showResults;

    /** The final grade is out of this (e.g. 20), whatever the questions' points add up to. */
    @Column(nullable = false)
    private int gradeScale;

    /** The questions, answer key included, as JSON — always read and written whole. */
    @Column(nullable = false, length = 200_000)
    private String questionsJson;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Exam() {}

    public Exam(Course course, User teacher, String title, String instructions, int durationMin, Instant opensAt,
                Instant closesAt, boolean showResults, int gradeScale, List<ExamQuestion> questions) {
        this.course = course;
        this.teacher = teacher;
        this.title = title;
        this.instructions = instructions;
        this.durationMin = durationMin;
        this.opensAt = opensAt;
        this.closesAt = closesAt;
        this.showResults = showResults;
        this.gradeScale = gradeScale;
        this.questionsJson = Json.write(questions);
    }

    public enum Window { upcoming, open, closed }

    public Window window(Instant now) {
        if (now.isBefore(opensAt)) return Window.upcoming;
        if (!now.isBefore(closesAt)) return Window.closed;
        return Window.open;
    }

    /** When an attempt started at {@code startedAt} must end: its full duration, cut short by the exam closing. */
    public Instant deadlineFor(Instant startedAt) {
        Instant byDuration = startedAt.plus(Duration.ofMinutes(durationMin));
        return byDuration.isBefore(closesAt) ? byDuration : closesAt;
    }

    public List<ExamQuestion> getQuestions() { return Json.read(questionsJson, QUESTIONS); }

    public int totalPoints() {
        return getQuestions().stream().mapToInt(ExamQuestion::points).sum();
    }

    public String getId() { return id; }
    public Course getCourse() { return course; }
    public User getTeacher() { return teacher; }
    public String getTitle() { return title; }
    public String getInstructions() { return instructions; }
    public int getDurationMin() { return durationMin; }
    public Instant getOpensAt() { return opensAt; }
    public Instant getClosesAt() { return closesAt; }
    public boolean isShowResults() { return showResults; }
    public int getGradeScale() { return gradeScale; }
    public Instant getCreatedAt() { return createdAt; }
}
