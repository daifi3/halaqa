package dz.halaqa.course;

import dz.halaqa.auth.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Course permission checks shared by everything that lives under a course (homework, exams). */
@Component
public class CourseAccess {
    private final CourseRepository courses;

    public CourseAccess(CourseRepository courses) {
        this.courses = courses;
    }

    /** The course, if the user teaches it or is on its roster. */
    public Course accessible(String courseId, User me) {
        Course course = courses.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        if (!course.canAccess(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not enrolled in this course");
        return course;
    }

    /** The course, if the user is its teacher. */
    public Course owned(String courseId, User me) {
        Course course = accessible(courseId, me);
        if (!isOwner(course, me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the course teacher can do this");
        return course;
    }

    public static boolean isOwner(Course course, User me) {
        return course.getTeacher().getId().equals(me.getId());
    }
}
