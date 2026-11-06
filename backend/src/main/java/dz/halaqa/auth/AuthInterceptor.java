package dz.halaqa.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Resolves "Authorization: Bearer <token>" into a User request attribute. */
@Configuration
public class AuthInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    public static final String USER_ATTR = "user";

    /** API endpoints that work without a token. The OpenAPI docs read this too, so they can't drift apart. */
    public static final List<String> PUBLIC_PATHS = List.of("/api/auth/sign-up", "/api/auth/sign-in", "/api/livekit/webhook");

    private final AuthRepositories.Tokens tokens;

    public AuthInterceptor(AuthRepositories.Tokens tokens) {
        this.tokens = tokens;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            var token = tokens.findById(header.substring(7));
            if (token.isPresent()) {
                req.setAttribute(USER_ATTR, token.get().getUser());
                return true;
            }
        }
        res.setStatus(401);
        res.setContentType("application/json");
        res.getWriter().write("{\"message\":\"Please sign in again\"}");
        return false;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this)
                .addPathPatterns("/api/**")
                .excludePathPatterns(PUBLIC_PATHS);
    }
}
