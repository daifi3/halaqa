package dz.halaqa.common;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves uploaded avatars from local disk at /avatars/**. Avatars are small,
 * non-sensitive images, so — unlike vault documents — a plain public URL is fine.
 */
@Configuration
public class StaticFilesConfig implements WebMvcConfigurer {

    private final HalaqaProperties props;

    public StaticFilesConfig(HalaqaProperties props) {
        this.props = props;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String dir = props.storage().avatarDir();
        registry.addResourceHandler("/avatars/**").addResourceLocations("file:" + dir + "/");
    }
}
