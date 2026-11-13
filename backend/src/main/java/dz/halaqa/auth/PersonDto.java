package dz.halaqa.auth;

/**
 * How another person (a course's teacher, a submission's student, a document's owner)
 * appears in API responses. Built from the live User row, so a new name or profile
 * picture shows up everywhere on the next fetch.
 */
public record PersonDto(String id, String name, String avatarUrl) {
    public static PersonDto of(User u) {
        return new PersonDto(u.getId(), u.getName(), u.getAvatarUrl());
    }
}
