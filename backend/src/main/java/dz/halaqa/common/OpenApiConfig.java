package dz.halaqa.common;

import dz.halaqa.auth.AuthInterceptor;
import dz.halaqa.auth.User;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI docs: spec at /v3/api-docs, Swagger UI at /swagger-ui.html.
 *
 * Every /api endpoint needs "Authorization: Bearer &lt;token&gt;" (the token comes
 * back from sign-up / sign-in) except {@link AuthInterceptor#PUBLIC_PATHS}, and
 * the docs mark them the same way.
 */
@Configuration
public class OpenApiConfig {
    private static final String BEARER = "bearer";

    static {
        // Controllers receive the signed-in user via @RequestAttribute, filled in by
        // AuthInterceptor from the token. Clients never send it, so keep it out of the docs.
        SpringDocUtils.getConfig().addRequestWrapperToIgnore(User.class);
    }

    @Bean
    public OpenAPI halaqaOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Halaqa API")
                        .version("0.1.0")
                        .description("""
                                Backend for the Halaqa virtual classroom app: accounts, courses, \
                                live sessions (LiveKit), recordings and the document vault.

                                **Authentication** — call `POST /api/auth/sign-in` (or sign-up), copy the \
                                `token` from the response, then use **Authorize** above and paste it."""))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .description("The token returned by sign-up / sign-in.")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }

    /** Public endpoints (and the file URLs outside /api) don't take a token — say so per operation. */
    @Bean
    public OpenApiCustomizer publicEndpoints() {
        return api -> api.getPaths().forEach((path, item) -> {
            boolean isPublic = AuthInterceptor.PUBLIC_PATHS.contains(path) || !path.startsWith("/api/");
            if (isPublic) item.readOperations().forEach(op -> op.setSecurity(List.of()));
        });
    }
}
