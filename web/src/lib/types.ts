export type Role = 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

/** Someone shown next to a course, session, document, submission or attempt. */
export type Person = Pick<User, 'id' | 'name' | 'avatarUrl'>;

/** What sign-up, sign-in and token refresh return. */
export interface AuthSession {
  user: User;
  /** Short-lived access token. */
  token: string;
  /** Single-use token that buys a new pair at /auth/refresh. */
  refreshToken: string;
}

export type RoomStatus = 'scheduled' | 'live' | 'ended';

/** A student's answer to a session invite. Joining with the code counts as accepting. */
export type RsvpStatus = 'pending' | 'accepted' | 'declined';

export interface Room {
  id: string;
  title: string;
  subject: string;
  /** ISO date-time */
  startsAt: string;
  durationMin: number;
  /** 6-letter code students type to join */
  joinCode: string;
  teacher: Person;
  invitedEmails: string[];
  status: RoomStatus;
  isRecording: boolean;
  /** Standing course this session belongs to, if any — its roster has access too. */
  courseId: string | null;
  courseTitle: string | null;
  /** The viewer's own RSVP — null for the teacher. */
  myRsvp: RsvpStatus | null;
}

/** One row of a session's guest list, as the teacher sees it. */
export interface RoomStudent {
  email: string;
  /** Null until the student has signed up for an account. */
  name: string | null;
  userId: string | null;
  avatarUrl?: string | null;
  status: RsvpStatus;
  /** How they got on the list: invited to this session, via the course roster, or joined with the code. */
  source: 'invite' | 'course' | 'code';
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  /** 6-letter code students type to enrol */
  joinCode: string;
  teacher: Person;
  /** Standing roster — visible to the teacher only. */
  invitedEmails: string[];
  /** Students who joined with the code (count only; the roster above is the real guest list). */
  memberCount: number;
  /** Sessions scheduled under this course. */
  roomCount: number;
  /** ISO date-time */
  createdAt: string;
}

export interface NewCourseInput {
  title: string;
  subject: string;
  description: string;
  invitedEmails: string[];
}

export interface Recording {
  id: string;
  roomId: string;
  roomTitle: string;
  subject: string;
  /** ISO date-time */
  recordedAt: string;
  durationSec: number;
  /** Playable MP4 / HLS url, null while still processing */
  url: string | null;
  status: 'processing' | 'ready' | 'failed';
}

export interface NewRoomInput {
  title: string;
  subject: string;
  startsAt: string;
  durationMin: number;
  invitedEmails: string[];
  /** Schedules this session under a standing course, inheriting its roster. */
  courseId?: string;
}

export interface JoinCredentials {
  /** LiveKit server websocket url */
  serverUrl: string;
  /** LiveKit access token for this user in this room */
  token: string;
}

/** A locally-picked file, ready to upload. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  /** The file the user picked in the browser — what gets uploaded. Absent for files from the server. */
  file?: Blob;
}

export interface VaultDocument {
  id: string;
  title: string;
  /** Free-text folder name for organizing the vault; null means unfiled. */
  folder: string | null;
  mimeType: string | null;
  sizeBytes: number;
  /** Playable/viewable URL — only ever returned for documents you can access. */
  url: string;
  /** ISO date-time */
  createdAt: string;
  owner: Person;
  /** Only populated for the owner; empty for people it's shared with. */
  sharedEmails: string[];
  /** True if the viewer is the owner (can rename, share, delete). */
  canManage: boolean;
}

export interface NewVaultDocumentInput extends PickedFile {
  title?: string;
  folder?: string;
}

export interface Homework {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  instructions: string;
  /** ISO date-time */
  dueAt: string;
  /** ISO date-time */
  createdAt: string;
  teacher: Person;
  /** Teacher only: how many students have handed in. */
  submissionCount?: number | null;
  /** Student only: when they last handed in (ISO), or null. */
  mySubmittedAt?: string | null;
}

/** A file attached to a submission. From the server, `uri` is its download URL. */
export type Attachment = PickedFile & { size: number };

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  student: Person;
  note: string;
  attachment: Attachment | null;
  /** ISO date-time */
  submittedAt: string;
  /** Handed in after the due date. */
  late?: boolean;
}

export interface SubmitHomeworkInput {
  note: string;
  /** A newly picked file replaces the attachment. */
  file: Attachment | null;
  /** Without a new file: keep the current attachment (true) or remove it (false). */
  keepAttachment: boolean;
}

/* ---------- Exams ---------- */

export type ExamQuestionKind = 'choice' | 'truefalse' | 'written';

export interface ExamQuestion {
  id: string;
  kind: ExamQuestionKind;
  prompt: string;
  /** Answer options — fixed to True/False for `truefalse`, empty for `written`. */
  options: string[];
  /** Index into `options`; null for written questions. */
  correct: number | null;
  points: number;
}

export interface Exam {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  instructions: string;
  durationMin: number;
  /** ISO date-time — students can start from here… */
  opensAt: string;
  /** …until here. An attempt started late still ends here. */
  closesAt: string;
  /** Whether students see their score once they submit. */
  showResults: boolean;
  /** The final grade is out of this (e.g. 20), whatever the questions' points add up to. */
  gradeScale: number;
  /**
   * From the server, a student gets no questions until they start, and no answer
   * key (`correct` is null) until their results are released.
   */
  questions: ExamQuestion[];
  /** Always set, even when `questions` is withheld. */
  questionCount: number;
  totalPoints: number;
  teacher: Person;
  /** ISO date-time */
  createdAt: string;
  /** Student only: their attempt, if they've started. */
  myAttempt?: ExamAttempt | null;
  /** Teacher only: finished attempts. */
  submissionCount?: number | null;
  /** Teacher only: attempts whose grade is final. */
  finalizedCount?: number | null;
}

export interface ExamScore {
  earned: number;
  total: number;
  /** Written answers still waiting for the teacher. */
  ungraded: number;
  /** `earned` converted onto `scale`. */
  grade: number;
  scale: number;
}

/** A chosen option index, or free text for written questions. */
export type ExamAnswer = number | string;

/** How an attempt ended. */
export type ExamFinish = 'submitted' | 'time_up' | 'left';

export interface ExamAttempt {
  id: string;
  examId: string;
  student: Person;
  /** ISO date-time */
  startedAt: string;
  /** ISO date-time — null while the student is still answering. */
  finishedAt: string | null;
  finish: ExamFinish | null;
  answers: Record<string, ExamAnswer>;
  /** Points the teacher awarded to written answers, by question id. */
  writtenGrades: Record<string, number>;
  /** ISO date-time the attempt must end — from the server. */
  deadline?: string;
  /** From the server: null for a student until their results are released or their grade is final. */
  score?: ExamScore | null;
  /** ISO date-time the teacher finalized the grade (it's then released to the student); null until then. */
  finalizedAt?: string | null;
}

/** What a teacher sends to create an exam. */
export type NewExamInput = Pick<
  Exam,
  'title' | 'instructions' | 'durationMin' | 'opensAt' | 'closesAt' | 'showResults' | 'gradeScale' | 'questions'
>;

/** An exam as demo mode keeps it on the device — the server-computed fields are derived on read. */
export type StoredExam = Omit<Exam, 'questionCount' | 'totalPoints' | 'myAttempt' | 'submissionCount' | 'finalizedCount'>;

/** A class chat message as the server stores it. `at` is epoch milliseconds. */
export interface StoredChatMessage {
  id: string;
  authorId: string;
  author: string;
  teacher: boolean;
  text: string;
  at: number;
}

/* ---------- Notifications (the bell) ---------- */

export type NotificationKind = 'exam_submitted' | 'exam_graded';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** The screen it opens, e.g. /exam/attempt/{id} — the same path in both apps. */
  link: string | null;
  /** ISO date-time */
  createdAt: string;
  /** ISO date-time — null while unread. */
  readAt: string | null;
}

export interface Inbox {
  items: AppNotification[];
  unread: number;
}
