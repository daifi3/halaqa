package dz.halaqa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
// AuthRepositories groups its repositories as nested interfaces, which Spring Data skips by default.
@EnableJpaRepositories(considerNestedRepositories = true)
// ExamSweeper closes exam attempts whose time ran out while the app was closed.
@EnableScheduling
public class HalaqaApplication {
    public static void main(String[] args) {
        SpringApplication.run(HalaqaApplication.class, args);
    }
}
