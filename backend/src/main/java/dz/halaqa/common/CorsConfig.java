package dz.halaqa.common;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Lets the web app (web/, a separate site) call the backend from the browser.
 * The mobile app doesn't need this: CORS only applies to browsers.
 *
 * A servlet filter that runs before everything else, on every path, so every response
 * carries the CORS headers — including errors that never reach a controller (an upload
 * over the size limit, /error) and the files under /avatars and /recordings. Otherwise
 * the browser hides the real error behind a "CORS error".
 *
 * Allowed sites come from halaqa.web-origins (env WEB_ORIGINS), comma separated, patterns
 * allowed (https://*.onrender.com, http://192.168.*.*:5173). The default "*" allows any
 * site: the API authenticates with "Authorization: Bearer" tokens, never cookies, so
 * another site can't act as a signed-in user. Set WEB_ORIGINS to lock it down anyway.
 */
@Configuration
public class CorsConfig {

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter(@Value("${halaqa.web-origins}") String[] origins) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOriginPatterns(Arrays.stream(origins).map(String::trim).filter(o -> !o.isEmpty()).toList());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
        cors.setAllowedHeaders(List.of("*"));
        // Lets the web app read the file name of downloads.
        cors.setExposedHeaders(List.of("Content-Disposition"));
        // Bearer tokens only: no cookies, so no credentials mode (which would also forbid "*").
        cors.setAllowCredentials(false);
        cors.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);

        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
