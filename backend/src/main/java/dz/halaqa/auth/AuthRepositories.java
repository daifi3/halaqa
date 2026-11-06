package dz.halaqa.auth;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public final class AuthRepositories {
    private AuthRepositories() {}

    public interface Users extends JpaRepository<User, String> {
        Optional<User> findByEmailIgnoreCase(String email);

        /** Emails are stored lower-cased at sign-up, so callers pass lower-cased values. */
        List<User> findByEmailIn(Collection<String> emails);
    }

    public interface Tokens extends JpaRepository<AuthToken, String> {}
}
