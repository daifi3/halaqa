package dz.halaqa.common;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "halaqa")
public record HalaqaProperties(String publicBaseUrl, LiveKit livekit, Storage storage, Auth auth, Recordings recordings,
                               Admin admin) {
    /** recordingEnabled: off where no Egress can write files (e.g. LiveKit Cloud without cloud storage). */
    public record LiveKit(String wsUrl, String apiUrl, String apiKey, String apiSecret, String egressOutputDir,
                          boolean recordingEnabled) {}

    /** Local-disk folders for uploaded files. Swap for S3/R2 in production. */
    public record Storage(String avatarDir, String vaultDir, String homeworkDir, String chatDir) {}

    /**
     * Where class recordings go. LiveKit Cloud can't write to this server's disk, so it uploads
     * them to S3-compatible storage (AWS S3, Cloudflare R2, Backblaze, MinIO…). Leave the bucket
     * empty to keep the self-hosted docker setup, where Egress writes into ./recordings.
     * publicUrl is where the bucket's files can be fetched (e.g. an R2 public bucket URL).
     */
    public record Recordings(String s3Bucket, String s3Region, String s3Endpoint, String s3AccessKey, String s3Secret,
                             String publicUrl) {
        public boolean s3() { return s3Bucket != null && !s3Bucket.isBlank(); }
    }

    /**
     * How long an access token works before the app must refresh it, and how long a refresh token lasts.
     * publicSignUp: whether anyone can create an account. Off by default: Halaqa admins create accounts.
     */
    public record Auth(Duration accessTokenTtl, Duration refreshTokenTtl, boolean publicSignUp) {}

    /** The first admin, created at startup when no admin exists yet (both values set). */
    public record Admin(String email, String password, String name) {}
}
