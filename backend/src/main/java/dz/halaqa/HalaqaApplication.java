package dz.halaqa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@ConfigurationPropertiesScan
// AuthRepositories groups its repositories as nested interfaces, which Spring Data skips by default.
@EnableJpaRepositories(considerNestedRepositories = true)
public class HalaqaApplication {
    public static void main(String[] args) {
        SpringApplication.run(HalaqaApplication.class, args);
    }
}
