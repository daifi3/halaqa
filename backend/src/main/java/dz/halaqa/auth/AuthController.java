package dz.halaqa.auth;

import dz.halaqa.common.FileStorage;
import dz.halaqa.common.HalaqaProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.nio.file.Path;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Auth", description = "Sign up, sign in, profile picture and password.")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record SignUpRequest(
            @NotBlank @Size(min = 2) String name,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 72) String password,
            @NotNull User.Role role) {}

    public record LogInRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6, max = 72) String newPassword) {}

    public record UserDto(String id, String name, String email, User.Role role, String avatarUrl) {
        static UserDto of(User u) { return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getAvatarUrl()); }
    }

    public record AuthResponse(UserDto user, String token) {}

    private final AuthRepositories.Users users;
    private final AuthRepositories.Tokens tokens;
    private final FileStorage storage;
    private final HalaqaProperties props;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthController(AuthRepositories.Users users, AuthRepositories.Tokens tokens, FileStorage storage, HalaqaProperties props) {
        this.users = users;
        this.tokens = tokens;
        this.storage = storage;
        this.props = props;
    }

    @PostMapping("/sign-up")
    @Transactional
    public AuthResponse signUp(@Valid @RequestBody SignUpRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        User user = users.save(new User(req.name().trim(), email, req.role(), encoder.encode(req.password())));
        AuthToken token = tokens.save(new AuthToken(user));
        return new AuthResponse(UserDto.of(user), token.getToken());
    }

    @PostMapping("/sign-in")
    @Transactional
    public AuthResponse signIn(@Valid @RequestBody LogInRequest req) {
        String email = req.email().trim().toLowerCase();
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        AuthToken token = tokens.save(new AuthToken(user));
        return new AuthResponse(UserDto.of(user), token.getToken());
    }

    @PostMapping("/me/avatar")
    public UserDto uploadAvatar(@RequestParam("file") MultipartFile file,
                                 @RequestAttribute(AuthInterceptor.USER_ATTR) User me) throws IOException {
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file provided");
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload an image");
        }
        String previous = me.getAvatarUrl();
        FileStorage.Stored stored = storage.save(file, Path.of(props.storage().avatarDir()));
        me.setAvatarUrl(props.publicBaseUrl() + "/avatars/" + stored.storedFilename());
        users.save(me);
        if (previous != null) {
            storage.delete(Path.of(props.storage().avatarDir()), previous.substring(previous.lastIndexOf('/') + 1));
        }
        return UserDto.of(me);
    }

    @DeleteMapping("/me/avatar")
    public UserDto removeAvatar(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        String previous = me.getAvatarUrl();
        if (previous != null) {
            storage.delete(Path.of(props.storage().avatarDir()), previous.substring(previous.lastIndexOf('/') + 1));
            me.setAvatarUrl(null);
            users.save(me);
        }
        return UserDto.of(me);
    }

    @PostMapping("/me/password")
    @Transactional
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        if (!encoder.matches(req.currentPassword(), me.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        me.setPasswordHash(encoder.encode(req.newPassword()));
        users.save(me);
    }
}
