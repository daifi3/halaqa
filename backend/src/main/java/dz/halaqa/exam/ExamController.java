package dz.halaqa.exam;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import dz.halaqa.course.Course;
import dz.halaqa.course.CourseAccess;
import dz.halaqa.course.CourseRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Exams and attempts. The server is the authority on everything a student could
 * otherwise fake from their phone: the exam window, the single attempt, the time
 * limit, which answers are accepted, the score — and it never sends a student the
 * questions before they start, nor the answer key before their results are released.
 */
@Tag(name = "Exams", description = "Timed exams on a course, students' attempts, and grading.")
@RestController
@RequestMapping("/api")
public class ExamController {

    public record QuestionInput(
            @NotBlank @Size(max = 40) String id,
            @NotNull ExamQuestion.Kind kind,
            @NotBlank @Size(max = 1000) String prompt,
            List<@NotBlank @Size(max = 300) String> options,
            Integer correct,
            @Min(1) @Max(100) int points) {}

    public record NewExamRequest(
            @NotBlank @Size(min = 3, max = 120) String title,
            @Size(max = 4000) String instructions,
            @Min(1) @Max(600) int durationMin,
            @NotNull Instant opensAt,
            @NotNull Instant closesAt,
            boolean showResults,
            @Min(1) @Max(1000) int gradeScale,
            @NotEmpty @Size(max = 100) List<@Valid QuestionInput> questions) {}

    /** A number (option index) for choice and true/false questions, text for written ones, or null to clear. */
    public record AnswerRequest(Object value) {}

    public record FinishRequest(@NotNull ExamAttempt.Finish reason) {}

    public record GradeRequest(@Min(0) int points) {}

    public record ScoreDto(int earned, int total, int ungraded, double grade, int scale) {}

    public record AttemptDto(String id, String examId, Map<String, String> student, Instant startedAt,
                             Instant deadline, Instant finishedAt, ExamAttempt.Finish finish,
                             Map<String, Object> answers, Map<String, Integer> writtenGrades,
                             /* Null for a student until their results are released. */ ScoreDto score) {}

    public record ExamDto(String id, String courseId, String courseTitle, String title, String instructions,
                          int durationMin, Instant opensAt, Instant closesAt, boolean showResults, int gradeScale,
                          Map<String, String> teacher, Instant createdAt,
                          /* Empty for a student until they start; no answer key until results are released. */
                          List<ExamQuestion> questions, int questionCount, int totalPoints,
                          /* Student only. */ AttemptDto myAttempt,
                          /* Teacher only: finished attempts. */ Long submissionCount) {}

    private final ExamRepositories.Exams exams;
    private final ExamRepositories.Attempts attempts;
    private final CourseAccess access;
    private final CourseRepository courses;

    public ExamController(ExamRepositories.Exams exams, ExamRepositories.Attempts attempts,
                          CourseAccess access, CourseRepository courses) {
        this.exams = exams;
        this.attempts = attempts;
        this.access = access;
        this.courses = courses;
    }

    /* ---------- Exams ---------- */

    @Operation(summary = "Exams on every course the user teaches or is enrolled in")
    @GetMapping("/exams")
    @Transactional
    public List<ExamDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        List<String> courseIds = courses.findVisibleTo(me.getId(), me.getEmail().toLowerCase()).stream().map(Course::getId).toList();
        if (courseIds.isEmpty()) return List.of();
        return exams.findByCourseIdInOrderByOpensAtDesc(courseIds).stream().map(e -> dto(e, me)).toList();
    }

    @GetMapping("/courses/{courseId}/exams")
    @Transactional
    public List<ExamDto> forCourse(@PathVariable String courseId, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        access.accessible(courseId, me);
        return exams.findByCourseIdOrderByOpensAtDesc(courseId).stream().map(e -> dto(e, me)).toList();
    }

    @Operation(summary = "Create an exam (course teacher)")
    @PostMapping("/courses/{courseId}/exams")
    @Transactional
    public ExamDto create(@PathVariable String courseId, @Valid @RequestBody NewExamRequest req,
                          @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = access.owned(courseId, me);
        if (!req.closesAt().isAfter(req.opensAt())) throw bad("The exam must close after it opens");
        if (req.closesAt().isBefore(req.opensAt().plusSeconds(req.durationMin() * 60L))) {
            throw bad("The exam must stay open at least as long as its time limit");
        }
        List<ExamQuestion> questions = validateQuestions(req.questions());
        Exam exam = new Exam(course, me, req.title().trim(), blankToNull(req.instructions()), req.durationMin(),
                req.opensAt(), req.closesAt(), req.showResults(), req.gradeScale(), questions);
        return dto(exams.save(exam), me);
    }

    @GetMapping("/exams/{id}")
    @Transactional
    public ExamDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return dto(accessible(id, me), me);
    }

    @Operation(summary = "Delete an exam and every attempt (course teacher)")
    @DeleteMapping("/exams/{id}")
    @Transactional
    public void delete(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Exam exam = owned(id, me);
        attempts.deleteAll(attempts.findByExamIdOrderByStartedAtDesc(id));
        exams.delete(exam);
    }

    /* ---------- Attempts ---------- */

    @Operation(summary = "Start the student's single attempt — the timer starts now",
            description = "Only while the exam is open, and only once. The response's `deadline` is when it ends.")
    @PostMapping("/exams/{id}/attempts")
    @Transactional
    public AttemptDto start(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Exam exam = accessible(id, me);
        if (isOwner(exam, me)) throw forbidden("Teachers don't take their own exams");
        if (attempts.findByExamIdAndStudentId(id, me.getId()).isPresent()) throw conflict("You have already taken this exam");
        Instant now = Instant.now();
        switch (exam.window(now)) {
            case upcoming -> throw conflict("This exam hasn't opened yet");
            case closed -> throw conflict("This exam has closed");
            case open -> { }
        }
        return dto(attempts.save(new ExamAttempt(exam, me)), me);
    }

    @Operation(summary = "Every attempt at an exam (course teacher)")
    @GetMapping("/exams/{id}/attempts")
    @Transactional
    public List<AttemptDto> attemptsFor(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        owned(id, me);
        Instant now = Instant.now();
        return attempts.findByExamIdOrderByStartedAtDesc(id).stream()
                .peek(a -> a.expireIfDue(now))
                .map(a -> dto(a, me))
                .toList();
    }

    @Operation(summary = "One attempt — for the course teacher, or the student who made it")
    @GetMapping("/exam-attempts/{id}")
    @Transactional
    public AttemptDto attempt(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        ExamAttempt a = attemptFor(id, me);
        a.expireIfDue(Instant.now());
        return dto(a, me);
    }

    @Operation(summary = "Save one answer while the attempt is running (student)",
            description = "`value`: an option index for choice and true/false questions, text for written ones, "
                    + "or null to clear. Rejected once the attempt is finished or its time is up.")
    @PutMapping("/exam-attempts/{id}/answers/{questionId}")
    @Transactional
    public AttemptDto answer(@PathVariable String id, @PathVariable String questionId, @RequestBody AnswerRequest req,
                             @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        ExamAttempt a = ownAttempt(id, me);
        if (a.expireIfDue(Instant.now())) throw conflict("Time is up — your answers were submitted");
        if (a.isFinished()) throw conflict("This attempt is finished and can't be changed");
        ExamQuestion q = a.getExam().getQuestions().stream().filter(x -> x.id().equals(questionId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such question in this exam"));
        a.setAnswer(questionId, checkedAnswer(q, req.value()));
        return dto(a, me);
    }

    @Operation(summary = "End the attempt for good (student)",
            description = "`reason`: `submitted`, or `left` when the student left the app. "
                    + "Recorded as `time_up` instead if the deadline has already passed.")
    @PostMapping("/exam-attempts/{id}/finish")
    @Transactional
    public AttemptDto finish(@PathVariable String id, @Valid @RequestBody FinishRequest req,
                             @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        if (req.reason() == ExamAttempt.Finish.time_up) throw bad("The server decides when time is up");
        ExamAttempt a = ownAttempt(id, me);
        Instant now = Instant.now();
        a.expireIfDue(now);
        a.finish(req.reason(), now);
        return dto(a, me);
    }

    @Operation(summary = "Award points to a written answer (course teacher)")
    @PutMapping("/exam-attempts/{id}/grades/{questionId}")
    @Transactional
    public AttemptDto grade(@PathVariable String id, @PathVariable String questionId, @Valid @RequestBody GradeRequest req,
                            @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        ExamAttempt a = attemptFor(id, me);
        if (!isOwner(a.getExam(), me)) throw forbidden("Only the course teacher can grade");
        a.expireIfDue(Instant.now());
        if (!a.isFinished()) throw conflict("Wait until the student has finished");
        ExamQuestion q = a.getExam().getQuestions().stream().filter(x -> x.id().equals(questionId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such question in this exam"));
        if (q.kind() != ExamQuestion.Kind.written) throw bad("Only written answers are graded by hand");
        if (req.points() > q.points()) throw bad("This question is worth at most " + q.points() + " points");
        a.setWrittenGrade(questionId, req.points());
        return dto(a, me);
    }

    /* ---------------------------------------------------------------- */

    private static List<ExamQuestion> validateQuestions(List<QuestionInput> input) {
        var ids = new HashSet<String>();
        return input.stream().map(q -> {
            if (!ids.add(q.id())) throw bad("Question ids must be unique");
            List<String> options = q.options() == null ? List.of() : q.options().stream().map(String::trim).toList();
            return switch (q.kind()) {
                case choice -> {
                    if (options.size() < 2 || options.size() > 6) throw bad("A multiple-choice question needs 2 to 6 options");
                    if (q.correct() == null || q.correct() < 0 || q.correct() >= options.size()) throw bad("Mark the correct option of every multiple-choice question");
                    yield new ExamQuestion(q.id(), q.kind(), q.prompt().trim(), options, q.correct(), q.points());
                }
                case truefalse -> {
                    if (q.correct() == null || q.correct() < 0 || q.correct() > 1) throw bad("Mark True or False as the correct answer");
                    yield new ExamQuestion(q.id(), q.kind(), q.prompt().trim(), ExamQuestion.TRUE_FALSE, q.correct(), q.points());
                }
                case written -> new ExamQuestion(q.id(), q.kind(), q.prompt().trim(), List.of(), null, q.points());
            };
        }).toList();
    }

    /** The answer, normalised — or a 400 when it doesn't fit the question. */
    private static Object checkedAnswer(ExamQuestion q, Object value) {
        if (value == null) return null;
        if (q.kind() == ExamQuestion.Kind.written) {
            if (!(value instanceof String text)) throw bad("A written answer must be text");
            if (text.length() > 5000) throw bad("That answer is too long");
            return text.isBlank() ? null : text;
        }
        if (!(value instanceof Integer index) || index < 0 || index >= q.options().size()) {
            throw bad("Choose one of the options");
        }
        return index;
    }

    private static ScoreDto score(Exam exam, ExamAttempt a) {
        Map<String, Object> answers = a.getAnswers();
        Map<String, Integer> grades = a.getWrittenGrades();
        int earned = 0, total = 0, ungraded = 0;
        for (ExamQuestion q : exam.getQuestions()) {
            total += q.points();
            Object answer = answers.get(q.id());
            if (q.kind() == ExamQuestion.Kind.written) {
                if (answer == null) continue;
                Integer g = grades.get(q.id());
                if (g == null) ungraded++;
                else earned += g;
            } else if (answer != null && answer.equals(q.correct())) {
                earned += q.points();
            }
        }
        double grade = total == 0 ? 0 : Math.round(earned * 100.0 / total * exam.getGradeScale()) / 100.0;
        return new ScoreDto(earned, total, ungraded, grade, exam.getGradeScale());
    }

    /** Results — the score and the answer key — are released to a student once they've finished, if the exam allows it. */
    private static boolean resultsVisible(Exam exam, ExamAttempt a, User viewer) {
        return isOwner(exam, viewer) || (a != null && a.isFinished() && exam.isShowResults());
    }

    private ExamDto dto(Exam e, User viewer) {
        boolean owner = isOwner(e, viewer);
        ExamAttempt mine = null;
        if (!owner) {
            mine = attempts.findByExamIdAndStudentId(e.getId(), viewer.getId()).orElse(null);
            if (mine != null) mine.expireIfDue(Instant.now());
        }
        List<ExamQuestion> all = e.getQuestions();
        List<ExamQuestion> visible = owner ? all
                : mine == null ? List.of()
                : resultsVisible(e, mine, viewer) ? all
                : all.stream().map(ExamQuestion::withoutAnswer).toList();
        return new ExamDto(e.getId(), e.getCourse().getId(), e.getCourse().getTitle(), e.getTitle(),
                e.getInstructions() == null ? "" : e.getInstructions(), e.getDurationMin(), e.getOpensAt(), e.getClosesAt(),
                e.isShowResults(), e.getGradeScale(), Map.of("id", e.getTeacher().getId(), "name", e.getTeacher().getName()),
                e.getCreatedAt(), visible, all.size(), e.totalPoints(),
                mine == null ? null : dto(mine, viewer),
                owner ? attempts.countByExamIdAndFinishIsNotNull(e.getId()) : null);
    }

    private static AttemptDto dto(ExamAttempt a, User viewer) {
        Exam exam = a.getExam();
        return new AttemptDto(a.getId(), exam.getId(),
                Map.of("id", a.getStudent().getId(), "name", a.getStudent().getName()),
                a.getStartedAt(), a.deadline(), a.getFinishedAt(), a.getFinish(), a.getAnswers(), a.getWrittenGrades(),
                resultsVisible(exam, a, viewer) ? score(exam, a) : null);
    }

    private Exam accessible(String id, User me) {
        Exam exam = exams.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Exam not found"));
        access.accessible(exam.getCourse().getId(), me);
        return exam;
    }

    private Exam owned(String id, User me) {
        Exam exam = accessible(id, me);
        if (!isOwner(exam, me)) throw forbidden("Only the course teacher can do this");
        return exam;
    }

    /** An attempt the user may read: their own, or any on an exam they teach. */
    private ExamAttempt attemptFor(String id, User me) {
        ExamAttempt a = attempts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found"));
        boolean mine = a.getStudent().getId().equals(me.getId());
        if (!mine && !isOwner(a.getExam(), me)) throw forbidden("You can't see this attempt");
        return a;
    }

    private ExamAttempt ownAttempt(String id, User me) {
        ExamAttempt a = attemptFor(id, me);
        if (!a.getStudent().getId().equals(me.getId())) throw forbidden("Only the student taking the exam can do this");
        return a;
    }

    private static boolean isOwner(Exam exam, User me) {
        return CourseAccess.isOwner(exam.getCourse(), me);
    }

    private static ResponseStatusException bad(String m) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
    private static ResponseStatusException forbidden(String m) { return new ResponseStatusException(HttpStatus.FORBIDDEN, m); }
    private static ResponseStatusException conflict(String m) { return new ResponseStatusException(HttpStatus.CONFLICT, m); }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
