package dz.halaqa.exam;

import java.util.List;

/**
 * One exam question, as stored and as sent to clients.
 *
 * @param options answer options — exactly ["True", "False"] for TRUEFALSE, empty for WRITTEN
 * @param correct index into {@code options}; null for WRITTEN questions, and null in what a
 *                student receives until their results are released
 */
public record ExamQuestion(String id, Kind kind, String prompt, List<String> options, Integer correct, int points) {

    public enum Kind { choice, truefalse, written }

    public static final List<String> TRUE_FALSE = List.of("True", "False");

    /** The same question without its answer key. */
    public ExamQuestion withoutAnswer() {
        return new ExamQuestion(id, kind, prompt, options, null, points);
    }
}
