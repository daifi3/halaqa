/**
 * Halaqa design tokens.
 * Warm paper background, deep ink text, one confident indigo accent.
 * The classroom itself switches to a dark "stage" palette so video pops.
 */
export const colors = {
  bg: '#F4F2EE',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE9E3',
  ink: '#16171C',
  inkSoft: '#3A3C44',
  muted: '#7A7C84',
  line: '#E2DED6',

  primary: '#4B44E0',
  primarySoft: '#E8E7FC',
  primaryInk: '#FFFFFF',

  teacher: '#4B44E0',
  teacherSoft: '#E8E7FC',
  student: '#E0763C',
  studentSoft: '#FBE9DF',

  success: '#1F9D6B',
  successSoft: '#DDF3EA',
  danger: '#E5484D',
  dangerSoft: '#FCE4E4',

  // Classroom "stage"
  stage: '#0F1014',
  stageCard: '#1B1C22',
  stageLine: '#2A2B33',
  stageText: '#F2F2F5',
  stageMuted: '#9A9BA6',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' as const },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1B1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  float: {
    shadowColor: '#1B1A2E',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

/** Spring presets shared across the app so motion feels consistent. */
export const springs = {
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  gentle: { damping: 20, stiffness: 180 },
  bouncy: { damping: 12, stiffness: 200 },
} as const;
