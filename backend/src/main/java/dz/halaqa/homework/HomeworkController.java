package dz.halaqa.homework;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import dz.halaqa.common.FileStorage;
import dz.halaqa.common.HalaqaProperties;
import dz.halaqa.course.Course;
import dz.halaqa.course.CourseAccess;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Homework", description = "Assignments set on a course, and students' submissions with an optional file.")
@RestController
@RequestMapping("/api")
public class HomeworkController {

    public record NewHomeworkRequest(
            @NotBlank @Size(min = 3, max = 120) String title,
            @Size(max = 4000) String instructions,
            @NotNull Instant dueAt) {}

    public record HomeworkDto(String id, String courseId, String courseTitle, String title, String instructions,
                              Instant dueAt, Instant createdAt, Map<String, String> teacher,
                              /* Teacher only: how many students have handed in. */ Long submissionCount,
                              /* Student only: when they last handed in, or null. */ Instant mySubmittedAt) {}

    /** `uri` is a download URL, so the app can treat it like any other picked file. */
    public record AttachmentDto(String uri, String name, String mimeType, long size) {}

    public record SubmissionDto(String id, String homeworkId, Map<String, String> student, String note,
                                AttachmentDto attachment, Instant submittedAt, boolean late) {}

    private final HomeworkRepositories.Assignments homework;
    private final HomeworkRepositories.Submissions submissions;
    private final CourseAccess access;
    private final FileStorage storage;
    private final HalaqaProperties props;

    public HomeworkController(HomeworkRepositories.Assignments homework, HomeworkRepositories.Submissions submissions,
                              CourseAccess access, FileStorage storage, HalaqaProperties props) {
        this.homework = homework;
        this.submissions = submissions;
        this.access = access;
        this.storage = storage;
        this.props = props;
    }

    @Operation(summary = "Homework on a course, soonest due first")
    @GetMapping("/courses/{courseId}/homework")
    public List<HomeworkDto> list(@PathVariable String courseId, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        access.accessible(courseId, me);
        return homework.findByCourseIdOrderByDueAtAsc(courseId).stream().map(h -> dto(h, me)).toList();
    }

    @Operation(summary = "Assign homework (course teacher)")
    @PostMapping("/courses/{courseId}/homework")
    @Transactional
    public HomeworkDto assign(@PathVariable String courseId, @Valid @RequestBody NewHomeworkRequest req,
                              @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Course course = access.owned(courseId, me);
        Homework hw = new Homework(course, me, req.title().trim(), blankToNull(req.instructions()), req.dueAt());
        return dto(homework.save(hw), me);
    }

    @GetMapping("/homework/{id}")
    public HomeworkDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return dto(accessible(id, me), me);
    }

    @Operation(summary = "Delete homework and every submission (course teacher)")
    @DeleteMapping("/homework/{id}")
    @Transactional
    public void delete(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Homework hw = owned(id, me);
        for (HomeworkSubmission s : submissions.findByHomeworkIdOrderBySubmittedAtDesc(id)) {
            storage.delete(dir(), s.getStoredFilename());
            submissions.delete(s);
        }
        homework.delete(hw);
    }

    @Operation(summary = "Every submission, newest first (course teacher)")
    @GetMapping("/homework/{id}/submissions")
    public List<SubmissionDto> submissionsFor(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        owned(id, me);
        return submissions.findByHomeworkIdOrderBySubmittedAtDesc(id).stream().map(this::dto).toList();
    }

    @Operation(summary = "The signed-in student's submission — 204 when they haven't handed in")
    @GetMapping("/homework/{id}/submissions/mine")
    public ResponseEntity<SubmissionDto> mine(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        accessible(id, me);
        return submissions.findByHomeworkIdAndStudentId(id, me.getId())
                .map(s -> ResponseEntity.ok(dto(s)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(summary = "Hand in, or replace an earlier submission",
            description = "Multipart. `file` replaces the attachment; without it the previous attachment is kept "
                    + "unless `keepAttachment=false`. Late submissions are accepted and flagged as late.")
    @PutMapping(value = "/homework/{id}/submissions/mine", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public SubmissionDto submit(@PathVariable String id,
                                @RequestParam(value = "note", required = false) String note,
                                @RequestParam(value = "file", required = false) MultipartFile file,
                                @RequestParam(value = "keepAttachment", defaultValue = "true") boolean keepAttachment,
                                @RequestAttribute(AuthInterceptor.USER_ATTR) User me) throws IOException {
        Homework hw = accessible(id, me);
        if (CourseAccess.isOwner(hw.getCourse(), me)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teachers don't hand in their own homework");
        }
        if (note != null && note.length() > 4000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "note is too long");

        HomeworkSubmission sub = submissions.findByHomeworkIdAndStudentId(id, me.getId())
                .orElseGet(() -> new HomeworkSubmission(hw, me));
        sub.setNote(blankToNull(note));
        if (file != null && !file.isEmpty()) {
            storage.delete(dir(), sub.getStoredFilename());
            FileStorage.Stored stored = storage.save(file, dir());
            sub.setAttachment(stored.storedFilename(), stored.originalFilename(), stored.contentType(), stored.size());
        } else if (!keepAttachment) {
            storage.delete(dir(), sub.getStoredFilename());
            sub.setAttachment(null, null, null, null);
        }
        sub.touch();
        return dto(submissions.save(sub));
    }

    /* ---------------------------------------------------------------- */

    private Homework accessible(String id, User me) {
        Homework hw = homework.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Homework not found"));
        access.accessible(hw.getCourse().getId(), me);
        return hw;
    }

    private Homework owned(String id, User me) {
        Homework hw = accessible(id, me);
        if (!CourseAccess.isOwner(hw.getCourse(), me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the course teacher can do this");
        return hw;
    }

    private HomeworkDto dto(Homework h, User viewer) {
        boolean owner = CourseAccess.isOwner(h.getCourse(), viewer);
        Instant mine = owner ? null : submissions.findByHomeworkIdAndStudentId(h.getId(), viewer.getId())
                .map(HomeworkSubmission::getSubmittedAt).orElse(null);
        return new HomeworkDto(h.getId(), h.getCourse().getId(), h.getCourse().getTitle(), h.getTitle(),
                h.getInstructions() == null ? "" : h.getInstructions(), h.getDueAt(), h.getCreatedAt(),
                Map.of("id", h.getTeacher().getId(), "name", h.getTeacher().getName()),
                owner ? submissions.countByHomeworkId(h.getId()) : null, mine);
    }

    private SubmissionDto dto(HomeworkSubmission s) {
        AttachmentDto attachment = s.getStoredFilename() == null ? null : new AttachmentDto(
                props.publicBaseUrl() + "/homework-files/" + s.getStoredFilename(), s.getOriginalFilename(),
                s.getMimeType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : s.getMimeType(),
                s.getSizeBytes() == null ? 0 : s.getSizeBytes());
        return new SubmissionDto(s.getId(), s.getHomework().getId(),
                Map.of("id", s.getStudent().getId(), "name", s.getStudent().getName()),
                s.getNote() == null ? "" : s.getNote(), attachment, s.getSubmittedAt(),
                s.getSubmittedAt().isAfter(s.getHomework().getDueAt()));
    }

    private Path dir() {
        return Path.of(props.storage().homeworkDir());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
