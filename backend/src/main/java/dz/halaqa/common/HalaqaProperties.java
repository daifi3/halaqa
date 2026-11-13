package dz.halaqa.common;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "halaqa")
public record HalaqaProperties(String publicBaseUrl, LiveKit livekit, Storage storage, Auth auth) {
    /** recordingEnabled: off where no Egress can write files (e.g. LiveKit Cloud without cloud storage). */
    public record LiveKit(String wsUrl, String apiUrl, String apiKey, String apiSecret, String egressOutputDir,
                          boolean recordingEnabled) {}

    /** Local-disk folders for uploaded files. Swap for S3/R2 in production. */
    public record Storage(String avatarDir, String vaultDir, String homeworkDir) {}

    /** How long an access token works before the app must refresh it, and how long a refresh token lasts. */
    public record Auth(Duration accessTokenTtl, Duration refreshTokenTtl) {}
}
