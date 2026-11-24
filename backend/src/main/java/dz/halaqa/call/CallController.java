package dz.halaqa.call;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.AuthRepositories;
import dz.halaqa.auth.PersonDto;
import dz.halaqa.auth.User;
import dz.halaqa.livekit.LiveKitService;
import dz.halaqa.notification.ExpoPushService;
import dz.halaqa.notification.PushToken;
import dz.halaqa.notification.PushTokenRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * One-to-one audio calls. The caller starts a call; the callee's phones get a push and
 * open apps see it in /incoming (they poll). Both then join the call's own LiveKit room
 * with a microphone-only token. Ringing calls nobody answers become "missed".
 */
@Tag(name = "Calls", description = "One-to-one audio calls over LiveKit.")
@RestController
@RequestMapping("/api/calls")
public class CallController {

    private static final int HISTORY = 50;

    public interface Calls extends JpaRepository<Call, String> {
        @Query("select c from Call c where c.caller.id = :userId or c.callee.id = :userId order by c.createdAt desc")
        List<Call> history(@Param("userId") String userId, PageRequest page);

        @Query("select c from Call c where c.callee.id = :userId and c.status = :status and c.createdAt > :since order by c.createdAt desc")
        List<Call> ringingFor(@Param("userId") String userId, @Param("status") Call.Status status, @Param("since") Instant since);

        /** Calls this user is in right now (ringing or connected), either side. */
        @Query("select c from Call c where (c.caller.id = :userId or c.callee.id = :userId) and c.status in :statuses and c.createdAt > :since")
        List<Call> activeFor(@Param("userId") String userId, @Param("statuses") Collection<Call.Status> statuses, @Param("since") Instant since);
    }

    public record StartCallRequest(@NotBlank String calleeId) {}

    /** `outgoing` is from the signed-in user's side. Times are ISO strings like elsewhere in the API. */
    public record CallDto(String id, PersonDto caller, PersonDto callee, boolean outgoing, Call.Status status,
                          Instant createdAt, Instant answeredAt, Instant endedAt) {
        static CallDto of(Call c, User me) {
            return new CallDto(c.getId(), PersonDto.of(c.getCaller()), PersonDto.of(c.getCallee()),
                    c.getCaller().getId().equals(me.getId()), c.getStatus(), c.getCreatedAt(), c.getAnsweredAt(), c.getEndedAt());
        }
    }

    private final Calls calls;
    private final AuthRepositories.Users users;
    private final LiveKitService livekit;
    private final PushTokenRepository pushTokens;
    private final ExpoPushService push;

    public CallController(Calls calls, AuthRepositories.Users users, LiveKitService livekit,
                          PushTokenRepository pushTokens, ExpoPushService push) {
        this.calls = calls;
        this.users = users;
        this.livekit = livekit;
        this.pushTokens = pushTokens;
        this.push = push;
    }

    @Operation(summary = "Call someone", description = "Rings the other person's phones and open apps. They have 45 seconds to answer.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CallDto start(@Valid @RequestBody StartCallRequest req, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        if (req.calleeId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can't call yourself");
        User callee = users.findById(req.calleeId()).filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This person doesn't have a Halaqa account"));
        if (isBusy(callee)) throw new ResponseStatusException(HttpStatus.CONFLICT, callee.getName() + " is on another call");

        Call call = calls.save(new Call(me, callee));
        ring(call);
        return CallDto.of(call, me);
    }

    @Operation(summary = "My recent calls, newest first")
    @GetMapping
    @Transactional
    public List<CallDto> history(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Instant now = Instant.now();
        var list = calls.history(me.getId(), PageRequest.of(0, HISTORY));
        list.forEach(c -> c.expireIfUnanswered(now));
        return list.stream().map(c -> CallDto.of(c, me)).toList();
    }

    @Operation(summary = "Calls ringing for me right now", description = "Open apps poll this every few seconds.")
    @GetMapping("/incoming")
    @Transactional(readOnly = true)
    public List<CallDto> incoming(@RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        return calls.ringingFor(me.getId(), Call.Status.ringing, Instant.now().minus(Call.RING)).stream().map(c -> CallDto.of(c, me)).toList();
    }

    @Operation(summary = "One call", description = "Both sides poll this to see it answered, declined or hung up.")
    @GetMapping("/{id}")
    @Transactional
    public CallDto get(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Call call = mine(id, me);
        call.expireIfUnanswered(Instant.now());
        return CallDto.of(call, me);
    }

    @Operation(summary = "Answer a ringing call")
    @PostMapping("/{id}/accept")
    @Transactional
    public CallDto accept(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Call call = mine(id, me);
        if (!call.getCallee().getId().equals(me.getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the person called can answer");
        call.expireIfUnanswered(Instant.now());
        if (call.getStatus() != Call.Status.ringing) throw new ResponseStatusException(HttpStatus.CONFLICT, "This call is no longer ringing");
        call.accept();
        return CallDto.of(call, me);
    }

    @Operation(summary = "Decline a ringing call")
    @PostMapping("/{id}/decline")
    @Transactional
    public CallDto decline(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Call call = mine(id, me);
        if (call.getStatus() == Call.Status.ringing && call.getCallee().getId().equals(me.getId())) call.finish(Call.Status.declined);
        return CallDto.of(call, me);
    }

    @Operation(summary = "Hang up", description = "Cancels a call still ringing, or ends a connected one for both sides.")
    @PostMapping("/{id}/end")
    @Transactional
    public CallDto end(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Call call = mine(id, me);
        if (call.getStatus() == Call.Status.ringing) {
            call.finish(call.getCaller().getId().equals(me.getId()) ? Call.Status.cancelled : Call.Status.declined);
        } else if (call.getStatus() == Call.Status.accepted) {
            call.finish(Call.Status.ended);
            afterCommit(() -> livekit.closeRoom(call.livekitName()));
        }
        return CallDto.of(call, me);
    }

    @Operation(summary = "LiveKit token for the call", description = "Microphone only. The caller may join while it rings; the callee once they answer.")
    @PostMapping("/{id}/token")
    @Transactional
    public Map<String, String> token(@PathVariable String id, @RequestAttribute(AuthInterceptor.USER_ATTR) User me) {
        Call call = mine(id, me);
        call.expireIfUnanswered(Instant.now());
        boolean caller = call.getCaller().getId().equals(me.getId());
        boolean open = call.getStatus() == Call.Status.accepted || (caller && call.getStatus() == Call.Status.ringing);
        if (!open) throw new ResponseStatusException(HttpStatus.CONFLICT, "This call has ended");
        return Map.of("serverUrl", livekit.wsUrl(), "token", livekit.createCallToken(call.livekitName(), me));
    }

    /**
     * Ringing for someone else, or in a connected call. A "connected" call whose LiveKit room is
     * empty was left behind by an app that closed without hanging up: it's ended here instead.
     */
    private boolean isBusy(User user) {
        Instant now = Instant.now();
        boolean busy = false;
        for (Call c : calls.activeFor(user.getId(), List.of(Call.Status.ringing, Call.Status.accepted), now.minus(Duration.ofHours(12)))) {
            if (c.getStatus() == Call.Status.ringing) {
                if (!c.expireIfUnanswered(now)) busy = true;
            } else if (livekit.participants(c.livekitName()).isEmpty()) {
                c.finish(Call.Status.ended);
            } else {
                busy = true;
            }
        }
        return busy;
    }

    private Call mine(String id, User me) {
        Call call = calls.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Call not found"));
        if (!call.involves(me)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Call not found");
        return call;
    }

    /** Pushes "X is calling you" to the callee's phones (calls aren't kept in the notification bell). */
    private void ring(Call call) {
        Map<String, Object> data = Map.of("kind", "call", "callId", call.getId(), "link", "/call/" + call.getId());
        String body = call.getCaller().getName() + " is calling you";
        List<ExpoPushService.Message> messages = pushTokens.findByUserId(call.getCallee().getId()).stream()
                .map(PushToken::getToken)
                .map(t -> new ExpoPushService.Message(t, "Incoming call", body, data))
                .toList();
        afterCommit(() -> push.sendLater(messages));
    }

    private static void afterCommit(Runnable run) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { run.run(); }
            });
        } else {
            run.run();
        }
    }
}
