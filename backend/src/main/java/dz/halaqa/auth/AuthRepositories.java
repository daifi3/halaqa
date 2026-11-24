package dz.halaqa.auth;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public final class AuthRepositories {
    private AuthRepositories() {}

    public interface Users extends JpaRepository<User, String>, JpaSpecificationExecutor<User> {
        Optional<User> findByEmailIgnoreCase(String email);

        /** Emails are stored lower-cased at sign-up, so callers pass lower-cased values. */
        List<User> findByEmailIn(Collection<String> emails);

        /** Bootstrap: is there an admin who can still sign in? */
        boolean existsByRoleAndStatus(User.Role role, User.Status status);

        long countByRoleAndStatus(User.Role role, User.Status status);

        List<User> findAllByOrderByCreatedAtDesc();
    }

    public interface Tokens extends JpaRepository<AuthToken, String> {
        /** Signs the user out everywhere (after an admin resets their password). */
        @Modifying
        @Query("delete from AuthToken t where t.user = :user")
        int deleteAllFor(@Param("user") User user);

        @Modifying
        @Query("delete from AuthToken t where t.user = :user and t.expiresAt < :now")
        int deleteExpired(@Param("user") User user, @Param("now") Instant now);
    }

    public interface RefreshTokens extends JpaRepository<RefreshToken, String> {
        @Modifying
        @Query("delete from RefreshToken r where r.user = :user")
        int deleteAllFor(@Param("user") User user);

        /** Returns 1 for the caller that consumed the token, 0 if someone else already did. */
        @Modifying
        @Query("delete from RefreshToken r where r.token = :token")
        int consume(@Param("token") String token);

        @Modifying
        @Query("delete from RefreshToken r where r.user = :user and r.expiresAt < :now")
        int deleteExpired(@Param("user") User user, @Param("now") Instant now);
    }
}
