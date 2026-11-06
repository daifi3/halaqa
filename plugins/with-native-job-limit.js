/**
 * Native (CMake) build settings for the environments this app is built in.
 *
 * EAS builds — caps parallel C/C++ compile jobs. Ninja defaults to one job per
 * core + 2; compiling Skia that way spikes past the 16 GB of the EAS Android
 * worker and the OS kills the Gradle daemon ("Gradle build daemon disappeared
 * unexpectedly"). Release C++ is also built as RelWithDebInfo, and producing and
 * linking that debug info (Skia above all) is what pushes release builds over
 * even with the job pool, so release keeps -O2 but drops -g: same speed, no
 * native debug symbols (only used to symbolicate native crash dumps). Debug
 * builds use their own flags and are unaffected.
 *
 * Local builds on Windows — CMake nests each source's absolute path inside the
 * build folder, so deep packages (gesture-handler's codegen) exceed Windows'
 * 248-character directory limit, and CMake doesn't shorten those paths. The
 * Ninja bundled with Android's default CMake (3.22.1) can't use long paths;
 * the one in CMake 3.31 can, once Windows long paths are enabled (a one-time
 * admin setting). Expo's `android.cmakeVersion` property selects that CMake.
 * Cloud (Linux) builds keep the default CMake.
 */
const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// with-native-job-limit';
const CMAKE_VERSION = 'android.cmakeVersion';
const WINDOWS_CMAKE = '3.31.6';

function withEasNativeLimits(config, jobs) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += `
${MARKER}
subprojects {
  ['com.android.library', 'com.android.application'].each { id ->
    plugins.withId(id) {
      android.defaultConfig.externalNativeBuild.cmake.arguments(
        '-DCMAKE_JOB_POOLS=compile=${jobs};link=1',
        '-DCMAKE_JOB_POOL_COMPILE=compile',
        '-DCMAKE_JOB_POOL_LINK=link',
        '-DCMAKE_C_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG',
        '-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O2 -DNDEBUG'
      )
    }
  }
}
`;
    return cfg;
  });
}

function withLongPathCmake(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === CMAKE_VERSION));
    cfg.modResults.push({ type: 'property', key: CMAKE_VERSION, value: WINDOWS_CMAKE });
    return cfg;
  });
}

module.exports = function withNativeJobLimit(config, { jobs = 2 } = {}) {
  // EAS_BUILD_PROFILE is set by EAS for every cloud build, whatever the profile.
  if (process.env.EAS_BUILD_PROFILE) config = withEasNativeLimits(config, jobs);
  if (process.platform === 'win32') config = withLongPathCmake(config);
  return config;
};
