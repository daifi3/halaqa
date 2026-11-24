package dz.halaqa.admin;

import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.User;
import dz.halaqa.common.HalaqaProperties;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public sign-up is off, so someone has to create the first account. With ADMIN_EMAIL (and
 * ADMIN_PASSWORD for a new account) set and no admin in the database yet, this creates that
 * admin at startup, or promotes the existing account with that email (keeping its password).
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AuthRepositories.Users users;
    private final HalaqaProperties props;

    public AdminBootstrap(AuthRepositories.Users users, HalaqaProperties props) {
        this.users = users;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.existsByRoleAndStatus(User.Role.admin, User.Status.active)) return;
        HalaqaProperties.Admin admin = props.admin();
        String email = admin == null || admin.email() == null ? "" : admin.email().trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty()) {
            log.warn("No Halaqa admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD and restart to create one.");
            return;
        }
        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            existing.get().setRole(User.Role.admin);
            existing.get().restore(); // The last way back in if every admin account was closed.
            users.save(existing.get());
            log.info("Promoted {} to Halaqa admin", email);
            return;
        }
        if (admin.password() == null || admin.password().length() < 6) {
            log.warn("ADMIN_PASSWORD must be at least 6 characters; no admin created.");
            return;
        }
        String name = admin.name() == null || admin.name().isBlank() ? "Halaqa admin" : admin.name().trim();
        users.save(new User(name, email, User.Role.admin, new BCryptPasswordEncoder().encode(admin.password())));
        log.info("Created Halaqa admin {}", email);
    }
}
