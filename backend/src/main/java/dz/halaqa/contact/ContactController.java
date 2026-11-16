package dz.halaqa.contact;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.PersonDto;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Tag(name = "Contacts", description = "Each user's private address book. Contacts with a Halaqa account can be called.")
@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    public interface Contacts extends JpaRepository<Contact, String> {
        List<Contact> findByOwnerIdOrderByNameAsc(String ownerId);
    }

    public record ContactRequest(
            @NotBlank @Size(max = 120) String name,
            @Email @Size(max = 255) String email,
            @Size(max = 40) String phone,
            @Size(max = 500) String note) {}

    /** `user` is the Halaqa account behind the email, when there is one: that's who a call rings. */
    public record ContactDto(String id, String name, String email, String phone, String note, PersonDto user, Instant createdAt) {}

    private final Contacts contacts;
    private final AuthRepositories.Users users;

    public ContactController(Contacts contacts, AuthRepositories.Users users) {
        this.contacts = contacts;
        this.users = users;
    }

    @Operation(summary = "My contacts, by name")
    @GetMapping
    @Transactional(readOnly = true)
    public List<ContactDto> list(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        List<Contact> mine = contacts.findByOwnerIdOrderByNameAsc(me.getId());
        List<String> emails = mine.stream().map(Contact::getEmail).filter(e -> e != null).distinct().toList();
        Map<String, User> accounts = emails.isEmpty() ? Map.of()
                : users.findByEmailIn(emails).stream().collect(Collectors.toMap(User::getEmail, Function.identity(), (a, b) -> a));
        return mine.stream().map(c -> dto(c, accounts.get(c.getEmail()), me)).toList();
    }

    @Operation(summary = "One contact")
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ContactDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return dto(owned(id, me), me);
    }

    @Operation(summary = "Add a contact")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ContactDto create(@Valid @RequestBody ContactRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Contact c = new Contact(me);
        apply(c, req);
        return dto(contacts.save(c), me);
    }

    @Operation(summary = "Edit a contact")
    @PutMapping("/{id}")
    @Transactional
    public ContactDto update(@PathVariable String id, @Valid @RequestBody ContactRequest req,
                             @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Contact c = owned(id, me);
        apply(c, req);
        return dto(c, me);
    }

    @Operation(summary = "Delete a contact")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        contacts.delete(owned(id, me));
    }

    private static void apply(Contact c, ContactRequest req) {
        c.update(req.name().trim(), blankToNull(req.email(), true), blankToNull(req.phone(), false), blankToNull(req.note(), false));
    }

    private static String blankToNull(String s, boolean lower) {
        if (s == null || s.isBlank()) return null;
        return lower ? s.trim().toLowerCase() : s.trim();
    }

    private Contact owned(String id, User me) {
        Contact c = contacts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found"));
        // Someone else's contact looks exactly like a missing one.
        if (!c.getOwner().getId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found");
        return c;
    }

    private ContactDto dto(Contact c, User me) {
        User account = c.getEmail() == null ? null : users.findByEmailIgnoreCase(c.getEmail()).orElse(null);
        return dto(c, account, me);
    }

    private static ContactDto dto(Contact c, User account, User me) {
        // You can't call yourself.
        PersonDto person = account == null || account.getId().equals(me.getId()) ? null : PersonDto.of(account);
        return new ContactDto(c.getId(), c.getName(), c.getEmail(), c.getPhone(), c.getNote(), person, c.getCreatedAt());
    }
}
