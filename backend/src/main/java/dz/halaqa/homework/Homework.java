package dz.halaqa.homework;

import dz.halaqa.auth.User;
import dz.halaqa.course.Course;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** An assignment a teacher sets for everyone on a course's roster. */
@Entity
@Table(name = "homework")
public class Homework {
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
    private Instant dueAt;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Homework() {}

    public Homework(Course course, User teacher, String title, String instructions, Instant dueAt) {
        this.course = course;
        this.teacher = teacher;
        this.title = title;
        this.instructions = instructions;
        this.dueAt = dueAt;
    }

    public String getId() { return id; }
    public Course getCourse() { return course; }
    public User getTeacher() { return teacher; }
    public String getTitle() { return title; }
    public String getInstructions() { return instructions; }
    public Instant getDueAt() { return dueAt; }
    public Instant getCreatedAt() { return createdAt; }
}
