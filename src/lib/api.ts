import { File as FsFile } from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { config } from './config';
import { attemptDeadline, examWindow, formatGrade, scoreAttempt } from './exam';
import type {
  AuthSession, Course, Exam, ExamAnswer, ExamAttempt, Homework, HomeworkSubmission, JoinCredentials, NewCourseInput, NewExamInput,
  NewRoomInput, NewVaultDocumentInput, PickedFile, Recording, Role, Room, RoomStudent, RsvpStatus, StoredChatMessage,
  StoredExam, SubmitHomeworkInput, User, VaultDocument, AppNotification, Inbox, NotificationKind,
} from './types';
import { useDemoNotifications } from '@/store/demo-notifications';
import { useExamsStore } from '@/store/exams';
import { getPushToken, setPushToken } from './push-token';
import { useHomeworkStore } from '@/store/homework';
import { useSession } from '@/store/session';

export interface Api {
  signUp(input: { name: string; email: string; password: string; role: Role }): Promise<AuthSession>;
  logIn(input: { email: string; password: string }): Promise<AuthSession>;
  /** Clears the session on this device and revokes its tokens on the server. */
  signOut(): Promise<void>;
  uploadAvatar(file: PickedFile): Promise<User>;
  removeAvatar(): Promise<User>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  listRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room>;
  createRoom(input: NewRoomInput): Promise<Room>;
  joinByCode(code: string): Promise<Room>;
  startRoom(id: string): Promise<Room>;
  endRoom(id: string): Promise<Room>;
  getJoinCredentials(id: string): Promise<JoinCredentials>;
  /** Student answers a session invite. */
  respondToRoom(id: string, response: Exclude<RsvpStatus, 'pending'>): Promise<Room>;
  /** Teacher only — everyone who can attend this session, with their RSVP. */
  listRoomStudents(id: string): Promise<RoomStudent[]>;
  startRecording(id: string): Promise<Room>;
  stopRecording(id: string): Promise<Room>;
  /** Teacher only — lets one student share their screen, or stops them. */
  setScreenShareGrant(roomId: string, userId: string, allow: boolean): Promise<void>;
  /** Teacher only — lets every student share without asking, or takes it back. */
  setScreenSharePolicy(roomId: string, open: boolean): Promise<void>;
  /** Teacher only — turns off one student's microphone. They can turn it back on. */
  muteStudent(roomId: string, userId: string): Promise<void>;
  /** Teacher only — turns off every student's microphone. */
  muteAllStudents(roomId: string): Promise<void>;
  listRecordings(): Promise<Recording[]>;
  listCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course>;
  createCourse(input: NewCourseInput): Promise<Course>;
  inviteToCourse(id: string, emails: string[]): Promise<Course>;
  joinCourseByCode(code: string): Promise<Course>;
  listCourseRooms(id: string): Promise<Room[]>;
  listMyVault(): Promise<VaultDocument[]>;
  listSharedWithMe(): Promise<VaultDocument[]>;
  getVaultDocument(id: string): Promise<VaultDocument>;
  uploadVaultDocument(input: NewVaultDocumentInput): Promise<VaultDocument>;
  shareVaultDocument(id: string, emails: string[]): Promise<VaultDocument>;
  unshareVaultDocument(id: string, email: string): Promise<VaultDocument>;
  deleteVaultDocument(id: string): Promise<void>;

  // Homework
  listCourseHomework(courseId: string): Promise<Homework[]>;
  getHomework(id: string): Promise<Homework>;
  /** Course teacher only. */
  assignHomework(courseId: string, input: { title: string; instructions: string; dueAt: string }): Promise<Homework>;
  /** Course teacher only — every submission, newest first. */
  listHomeworkSubmissions(id: string): Promise<HomeworkSubmission[]>;
  /** The signed-in student's submission, or null. */
  getMySubmission(id: string): Promise<HomeworkSubmission | null>;
  /** Hand in, or replace an earlier submission. */
  submitHomework(id: string, input: SubmitHomeworkInput): Promise<HomeworkSubmission>;

  // Exams
  /** Exams on every course the user teaches or is enrolled in. */
  listExams(): Promise<Exam[]>;
  listCourseExams(courseId: string): Promise<Exam[]>;
  getExam(id: string): Promise<Exam>;
  /** Course teacher only. */
  createExam(courseId: string, input: NewExamInput): Promise<Exam>;
  deleteExam(id: string): Promise<void>;
  /** Starts the student's single attempt; the timer runs from now. */
  startExam(id: string): Promise<ExamAttempt>;
  /** Course teacher only. */
  listExamAttempts(examId: string): Promise<ExamAttempt[]>;
  getExamAttempt(id: string): Promise<ExamAttempt>;
  saveExamAnswer(attemptId: string, questionId: string, value: ExamAnswer | null): Promise<ExamAttempt>;
  /** Ends the attempt for good. The server records `time_up` instead once the deadline has passed. */
  finishExamAttempt(attemptId: string, reason: 'submitted' | 'left'): Promise<ExamAttempt>;
  /** Course teacher only — points for a written answer. Refused once the grade is final. */
  gradeExamAnswer(attemptId: string, questionId: string, points: number): Promise<ExamAttempt>;
  /** Course teacher only — locks the grade and releases it to the student, who is notified. Every written answer must be graded. */
  finalizeExamAttempt(attemptId: string): Promise<ExamAttempt>;
  /** Course teacher only — unlocks a final grade to change it. */
  reopenExamAttempt(attemptId: string): Promise<ExamAttempt>;
  /** Course teacher only — finalizes every fully graded attempt; returns all the attempts. */
  finalizeAllExamAttempts(examId: string): Promise<ExamAttempt[]>;

  // Notifications (the bell)
  listNotifications(): Promise<Inbox>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  /** Registers this phone's Expo push token, with the notification kinds turned off on it. */
  registerPushToken(input: { token: string; platform: string; muted: NotificationKind[] }): Promise<void>;
  /** Stops pushes to this phone (sign-out, or notifications turned off). */
  removePushToken(token: string): Promise<void>;

  // Class chat history (live delivery goes over LiveKit)
  listRoomMessages(roomId: string): Promise<StoredChatMessage[]>;
  postRoomMessage(roomId: string, message: { id: string; text: string }): Promise<StoredChatMessage>;
}

/* ------------------------------------------------------------------ */
/* HTTP implementation — talks to the Spring Boot backend              */
/* ------------------------------------------------------------------ */

/**
 * A picked file as a multipart part, keeping its original name and type.
 * Expo's fetch (the global `fetch` since SDK 58) can't send React Native's old
 * `{ uri, name, type }` parts; it reads any part that has `bytes()`.
 */
async function filePart(file: PickedFile): Promise<Blob> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    return new File([blob], file.name, { type: file.mimeType });
  }
  const source = new FsFile(file.uri);
  return { name: file.name, type: file.mimeType, bytes: () => source.bytes() } as unknown as Blob;
}

/** Builds the multipart body expected by the backend's file-upload endpoints. */
async function fileForm(file: PickedFile, extra?: Record<string, string | undefined>) {
  const form = new FormData();
  form.append('file', await filePart(file));
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) form.append(key, value);
  }
  return form;
}

/** Thrown when the access token expired and the refresh token can't renew it; the user has been signed out. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
  }
}

/** Endpoints that don't use the access token: a 401 there means wrong credentials, not an expired session. */
const PUBLIC_AUTH_PATHS = ['/auth/sign-up', '/auth/sign-in', '/auth/refresh', '/auth/sign-out'];

/** Signs out once (concurrent failing requests all land here) and tells the user why. */
function expireSession() {
  if (!useSession.getState().user) return;
  useSession.getState().signOut(); // Protected routes send the user back to the sign-in screens.
  Alert.alert('Session expired', 'Please sign in again to continue.');
}

let refreshing: Promise<string | null> | null = null;

/**
 * Trades the refresh token for a new token pair and returns the new access token,
 * or null when the session is over (refresh token expired or revoked — the user is signed out).
 * Network errors are thrown instead, so being offline never signs anyone out.
 *
 * Refresh tokens are single-use, so concurrent 401s must share one refresh call:
 * a second call with the same refresh token would be rejected.
 */
function refreshAccessToken(staleToken: string): Promise<string | null> {
  const { token, refreshToken } = useSession.getState();
  // Another request already refreshed while this one was in flight.
  if (token && token !== staleToken) return Promise.resolve(token);
  if (!refreshToken) {
    expireSession();
    return Promise.resolve(null);
  }
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const current = useSession.getState();
      // Signed out (or into another account) meanwhile: don't bring the old session back.
      if (current.refreshToken !== refreshToken) return current.token;
      if (res.status === 400 || res.status === 401) {
        expireSession();
        return null;
      }
      if (!res.ok) throw new Error(`Could not renew your session (${res.status})`);
      const session = (await res.json()) as AuthSession;
      current.setTokens(session.token, session.refreshToken);
      return session.token;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

class HttpApi implements Api {
  private async request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
    const token = useSession.getState().token;
    const isForm = init.body instanceof FormData;
    const res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    // Access token expired (or revoked): renew it once and replay the request.
    if (res.status === 401 && token && !isRetry && !PUBLIC_AUTH_PATHS.includes(path)) {
      const fresh = await refreshAccessToken(token);
      if (!fresh) throw new SessionExpiredError();
      return this.request<T>(path, init, true);
    }
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch {}
      throw new Error(message);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  signUp(input: { name: string; email: string; password: string; role: Role }) {
    return this.request<AuthSession>('/auth/sign-up', { method: 'POST', body: JSON.stringify(input) });
  }
  logIn(input: { email: string; password: string }) {
    return this.request<AuthSession>('/auth/sign-in', { method: 'POST', body: JSON.stringify(input) });
  }
  async signOut() {
    const { token, refreshToken } = useSession.getState();
    const pushToken = getPushToken();
    setPushToken(null);
    useSession.getState().signOut(); // Sign out right away; revoking on the server is best effort.
    const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    void (async () => {
      // Stop pushes to this phone first, while the access token still works.
      if (pushToken && token) {
        await this.request<void>(`/notifications/push-token?token=${encodeURIComponent(pushToken)}`, { method: 'DELETE', headers: auth })
          .catch(() => {});
      }
      if (refreshToken) {
        await this.request<void>('/auth/sign-out', { method: 'POST', body: JSON.stringify({ refreshToken }), headers: auth }).catch(() => {});
      }
    })();
  }
  async uploadAvatar(file: PickedFile) {
    return this.request<User>('/auth/me/avatar', { method: 'POST', body: await fileForm(file) });
  }
  removeAvatar() { return this.request<User>('/auth/me/avatar', { method: 'DELETE' }); }
  changePassword(input: { currentPassword: string; newPassword: string }) {
    return this.request<void>('/auth/me/password', { method: 'POST', body: JSON.stringify(input) });
  }
  listRooms() { return this.request<Room[]>('/rooms'); }
  getRoom(id: string) { return this.request<Room>(`/rooms/${id}`); }
  createRoom(input: NewRoomInput) { return this.request<Room>('/rooms', { method: 'POST', body: JSON.stringify(input) }); }
  joinByCode(code: string) {
    return this.request<Room>('/rooms/join', { method: 'POST', body: JSON.stringify({ code: code.toUpperCase() }) });
  }
  startRoom(id: string) { return this.request<Room>(`/rooms/${id}/start`, { method: 'POST' }); }
  endRoom(id: string) { return this.request<Room>(`/rooms/${id}/end`, { method: 'POST' }); }
  getJoinCredentials(id: string) { return this.request<JoinCredentials>(`/rooms/${id}/token`, { method: 'POST' }); }
  respondToRoom(id: string, response: Exclude<RsvpStatus, 'pending'>) {
    return this.request<Room>(`/rooms/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ response }) });
  }
  listRoomStudents(id: string) { return this.request<RoomStudent[]>(`/rooms/${id}/students`); }
  startRecording(id: string) { return this.request<Room>(`/rooms/${id}/recording/start`, { method: 'POST' }); }
  stopRecording(id: string) { return this.request<Room>(`/rooms/${id}/recording/stop`, { method: 'POST' }); }
  async setScreenShareGrant(roomId: string, userId: string, allow: boolean) {
    await this.request(`/rooms/${roomId}/screen-share/grant`, { method: 'POST', body: JSON.stringify({ userId, allow }) });
  }
  async setScreenSharePolicy(roomId: string, open: boolean) {
    await this.request(`/rooms/${roomId}/screen-share/policy`, { method: 'POST', body: JSON.stringify({ open }) });
  }
  async muteStudent(roomId: string, userId: string) {
    await this.request(`/rooms/${roomId}/mute`, { method: 'POST', body: JSON.stringify({ userId }) });
  }
  async muteAllStudents(roomId: string) {
    await this.request(`/rooms/${roomId}/mute-all`, { method: 'POST' });
  }
  listRecordings() { return this.request<Recording[]>('/recordings'); }
  listCourses() { return this.request<Course[]>('/courses'); }
  getCourse(id: string) { return this.request<Course>(`/courses/${id}`); }
  createCourse(input: NewCourseInput) { return this.request<Course>('/courses', { method: 'POST', body: JSON.stringify(input) }); }
  inviteToCourse(id: string, emails: string[]) {
    return this.request<Course>(`/courses/${id}/invite`, { method: 'POST', body: JSON.stringify({ emails }) });
  }
  joinCourseByCode(code: string) {
    return this.request<Course>('/courses/join', { method: 'POST', body: JSON.stringify({ code: code.toUpperCase() }) });
  }
  listCourseRooms(id: string) { return this.request<Room[]>(`/courses/${id}/rooms`); }
  listMyVault() { return this.request<VaultDocument[]>('/vault/mine'); }
  listSharedWithMe() { return this.request<VaultDocument[]>('/vault/shared'); }
  getVaultDocument(id: string) { return this.request<VaultDocument>(`/vault/${id}`); }
  async uploadVaultDocument(input: NewVaultDocumentInput) {
    return this.request<VaultDocument>('/vault', {
      method: 'POST',
      body: await fileForm(input, { title: input.title, folder: input.folder }),
    });
  }
  shareVaultDocument(id: string, emails: string[]) {
    return this.request<VaultDocument>(`/vault/${id}/share`, { method: 'POST', body: JSON.stringify({ emails }) });
  }
  unshareVaultDocument(id: string, email: string) {
    return this.request<VaultDocument>(`/vault/${id}/share/${encodeURIComponent(email)}`, { method: 'DELETE' });
  }
  deleteVaultDocument(id: string) { return this.request<void>(`/vault/${id}`, { method: 'DELETE' }); }

  listCourseHomework(courseId: string) { return this.request<Homework[]>(`/courses/${courseId}/homework`); }
  getHomework(id: string) { return this.request<Homework>(`/homework/${id}`); }
  assignHomework(courseId: string, input: { title: string; instructions: string; dueAt: string }) {
    return this.request<Homework>(`/courses/${courseId}/homework`, { method: 'POST', body: JSON.stringify(input) });
  }
  listHomeworkSubmissions(id: string) { return this.request<HomeworkSubmission[]>(`/homework/${id}/submissions`); }
  async getMySubmission(id: string) {
    // 204 when the student hasn't handed in yet.
    return (await this.request<HomeworkSubmission | undefined>(`/homework/${id}/submissions/mine`)) ?? null;
  }
  async submitHomework(id: string, input: SubmitHomeworkInput) {
    const form = new FormData();
    form.append('note', input.note);
    form.append('keepAttachment', String(input.keepAttachment));
    if (input.file) form.append('file', await filePart(input.file));
    return this.request<HomeworkSubmission>(`/homework/${id}/submissions/mine`, { method: 'PUT', body: form });
  }

  listExams() { return this.request<Exam[]>('/exams'); }
  listCourseExams(courseId: string) { return this.request<Exam[]>(`/courses/${courseId}/exams`); }
  getExam(id: string) { return this.request<Exam>(`/exams/${id}`); }
  createExam(courseId: string, input: NewExamInput) {
    return this.request<Exam>(`/courses/${courseId}/exams`, { method: 'POST', body: JSON.stringify(input) });
  }
  deleteExam(id: string) { return this.request<void>(`/exams/${id}`, { method: 'DELETE' }); }
  startExam(id: string) { return this.request<ExamAttempt>(`/exams/${id}/attempts`, { method: 'POST' }); }
  listExamAttempts(examId: string) { return this.request<ExamAttempt[]>(`/exams/${examId}/attempts`); }
  getExamAttempt(id: string) { return this.request<ExamAttempt>(`/exam-attempts/${id}`); }
  saveExamAnswer(attemptId: string, questionId: string, value: ExamAnswer | null) {
    return this.request<ExamAttempt>(`/exam-attempts/${attemptId}/answers/${encodeURIComponent(questionId)}`,
      { method: 'PUT', body: JSON.stringify({ value }) });
  }
  finishExamAttempt(attemptId: string, reason: 'submitted' | 'left') {
    return this.request<ExamAttempt>(`/exam-attempts/${attemptId}/finish`, { method: 'POST', body: JSON.stringify({ reason }) });
  }
  gradeExamAnswer(attemptId: string, questionId: string, points: number) {
    return this.request<ExamAttempt>(`/exam-attempts/${attemptId}/grades/${encodeURIComponent(questionId)}`,
      { method: 'PUT', body: JSON.stringify({ points }) });
  }
  finalizeExamAttempt(attemptId: string) {
    return this.request<ExamAttempt>(`/exam-attempts/${attemptId}/finalize`, { method: 'POST' });
  }
  reopenExamAttempt(attemptId: string) {
    return this.request<ExamAttempt>(`/exam-attempts/${attemptId}/finalize`, { method: 'DELETE' });
  }
  finalizeAllExamAttempts(examId: string) {
    return this.request<ExamAttempt[]>(`/exams/${examId}/finalize`, { method: 'POST' });
  }

  listNotifications() { return this.request<Inbox>('/notifications'); }
  async markNotificationRead(id: string) { await this.request<AppNotification>(`/notifications/${id}/read`, { method: 'POST' }); }
  markAllNotificationsRead() { return this.request<void>('/notifications/read-all', { method: 'POST' }); }
  registerPushToken(input: { token: string; platform: string; muted: NotificationKind[] }) {
    return this.request<void>('/notifications/push-token', { method: 'PUT', body: JSON.stringify(input) });
  }
  removePushToken(token: string) {
    return this.request<void>(`/notifications/push-token?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  }

  listRoomMessages(roomId: string) { return this.request<StoredChatMessage[]>(`/rooms/${roomId}/messages`); }
  postRoomMessage(roomId: string, message: { id: string; text: string }) {
    return this.request<StoredChatMessage>(`/rooms/${roomId}/messages`, { method: 'POST', body: JSON.stringify(message) });
  }
}

/* ------------------------------------------------------------------ */
/* Mock implementation — in-memory, lets you explore the whole UI     */
/* ------------------------------------------------------------------ */

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const code = () =>
  Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

/** Rooms as stored — the viewer-specific RSVP is projected on read. */
type StoredRoom = Omit<Room, 'myRsvp'>;

class MockApi implements Api {
  private rooms: StoredRoom[] = [
    {
      id: 'r1', title: 'Object-oriented design', subject: 'Computer Science', startsAt: inHours(0.1), durationMin: 90,
      joinCode: 'OOP24K', teacher: { id: 't-demo', name: 'Dr. Amrani' },
      invitedEmails: ['student@demo.dz', 'karim.h@demo.dz', 'lina.m@demo.dz', 'omar.s@demo.dz'],
      status: 'live', isRecording: false, courseId: 'c1', courseTitle: 'Algorithms & Data Structures',
    },
    {
      id: 'r2', title: 'Derivatives & limits', subject: 'Mathematics', startsAt: inHours(26), durationMin: 60,
      joinCode: 'MATH7Q', teacher: { id: 't-demo', name: 'Dr. Amrani' }, invitedEmails: [],
      status: 'scheduled', isRecording: false, courseId: null, courseTitle: null,
    },
    {
      id: 'r3', title: 'Reading circle: Ibn Khaldun', subject: 'History', startsAt: inHours(72), durationMin: 45,
      joinCode: 'HIST3R', teacher: { id: 't-demo', name: 'Dr. Amrani' }, invitedEmails: [],
      status: 'scheduled', isRecording: false, courseId: null, courseTitle: null,
    },
    {
      id: 'r4', title: 'Recursion & backtracking', subject: 'Computer Science', startsAt: inHours(50), durationMin: 90,
      joinCode: 'RECU91', teacher: { id: 't-demo', name: 'Dr. Amrani' }, invitedEmails: [],
      status: 'scheduled', isRecording: false, courseId: 'c1', courseTitle: 'Algorithms & Data Structures',
    },
  ];

  private courses: Course[] = [
    {
      id: 'c1', title: 'Algorithms & Data Structures', subject: 'Computer Science',
      description: 'A full-semester course: complexity, trees, graphs, and the algorithms built on top of them.',
      joinCode: 'ALGO9X', teacher: { id: 't-demo', name: 'Dr. Amrani' },
      invitedEmails: ['student@demo.dz'], memberCount: 0, roomCount: 0, createdAt: inHours(-240),
    },
    {
      id: 'c2', title: 'Classical Arabic Literature', subject: 'Languages',
      description: 'Close readings of foundational texts, from pre-Islamic poetry to the Nahda.',
      joinCode: 'LITR4M', teacher: { id: 't-demo', name: 'Dr. Amrani' },
      invitedEmails: [], memberCount: 0, roomCount: 0, createdAt: inHours(-96),
    },
  ];

  /** RSVPs per room, keyed by lower-cased student email. */
  private rsvps: Record<string, Record<string, RsvpStatus>> = {
    r1: { 'karim.h@demo.dz': 'accepted', 'lina.m@demo.dz': 'declined' },
  };

  /** Students who joined a room with its code. */
  private roomMembers: Record<string, Set<string>> = {};

  /** Students who self-enrolled with a course's join code (separate from the invited roster). */
  private courseMembers: Record<string, Set<string>> = {};

  /** Registered accounts — seeded so the demo data's teacher/student both have a working log-in. */
  private accounts: (User & { password: string })[] = [
    { id: 't-demo', name: 'Dr. Amrani', email: 'teacher@demo.dz', role: 'teacher', password: 'demo1234' },
    { id: 's-demo', name: 'Yasmine Bensalem', email: 'student@demo.dz', role: 'student', password: 'demo1234' },
    { id: 's-karim', name: 'Karim Haddad', email: 'karim.h@demo.dz', role: 'student', password: 'demo1234' },
    { id: 's-lina', name: 'Lina Mansouri', email: 'lina.m@demo.dz', role: 'student', password: 'demo1234' },
  ];

  private recordings: Recording[] = [
    { id: 'rec1', roomId: 'r0', roomTitle: 'Intro to UML diagrams', subject: 'Computer Science', recordedAt: inHours(-48), durationSec: 3720, url: SAMPLE_VIDEO, status: 'ready' },
    { id: 'rec2', roomId: 'r0', roomTitle: 'Inheritance vs composition', subject: 'Computer Science', recordedAt: inHours(-120), durationSec: 2890, url: SAMPLE_VIDEO, status: 'ready' },
    { id: 'rec3', roomId: 'r1', roomTitle: 'Object-oriented design', subject: 'Computer Science', recordedAt: inHours(-1), durationSec: 0, url: null, status: 'processing' },
  ];

  private vaultDocuments: VaultDocument[] = [
    {
      id: 'v1', title: 'Syllabus.pdf', folder: 'Algorithms & Data Structures', mimeType: 'application/pdf',
      sizeBytes: 182_000, url: SAMPLE_VIDEO, createdAt: inHours(-200),
      owner: { id: 't-demo', name: 'Dr. Amrani' }, sharedEmails: ['student@demo.dz'], canManage: true,
    },
    {
      id: 'v2', title: 'Midterm grading rubric.docx', folder: null, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 54_000, url: SAMPLE_VIDEO, createdAt: inHours(-30),
      owner: { id: 't-demo', name: 'Dr. Amrani' }, sharedEmails: [], canManage: true,
    },
  ];

  private me(): User {
    const u = useSession.getState().user;
    if (!u) throw new Error('Not signed in');
    return u;
  }

  private find(id: string) {
    const room = this.rooms.find((r) => r.id === id);
    if (!room) throw new Error('Room not found');
    return room;
  }

  private patch(id: string, p: Partial<StoredRoom>) {
    const room = this.find(id);
    Object.assign(room, p);
    return this.roomView(room);
  }

  /** Projects the viewer's own RSVP onto a stored room. */
  private roomView(r: StoredRoom): Room {
    const me = this.me();
    const myRsvp = r.teacher.id === me.id ? null : this.rsvps[r.id]?.[me.email.toLowerCase()] ?? 'pending';
    return { ...r, myRsvp };
  }

  private findCourse(id: string) {
    const course = this.courses.find((c) => c.id === id);
    if (!course) throw new Error('Course not found');
    return course;
  }

  /** Projects live counts (members, sessions) onto a stored course. */
  private courseView(c: Course): Course {
    return { ...c, memberCount: this.courseMembers[c.id]?.size ?? 0, roomCount: this.rooms.filter((r) => r.courseId === c.id).length };
  }

  async signUp(input: { name: string; email: string; password: string; role: Role }) {
    await wait(600);
    const email = input.email.trim().toLowerCase();
    if (this.accounts.some((a) => a.email === email)) throw new Error('An account with this email already exists');
    const user: User = { id: uid(), name: input.name.trim(), email, role: input.role, avatarUrl: null };
    this.accounts.push({ ...user, password: input.password });
    return { user, token: `mock-token-${user.id}`, refreshToken: `mock-refresh-${user.id}` };
  }

  async logIn(input: { email: string; password: string }) {
    await wait(600);
    const email = input.email.trim().toLowerCase();
    const account = this.accounts.find((a) => a.email === email);
    if (!account || account.password !== input.password) throw new Error('Invalid email or password');
    const user: User = { id: account.id, name: account.name, email: account.email, role: account.role, avatarUrl: account.avatarUrl ?? null };
    return { user, token: `mock-token-${user.id}`, refreshToken: `mock-refresh-${user.id}` };
  }

  async signOut() {
    useSession.getState().signOut();
  }

  async uploadAvatar(file: PickedFile) {
    await wait(500);
    const me = this.me();
    const account = this.accounts.find((a) => a.id === me.id);
    if (account) account.avatarUrl = file.uri;
    return { ...me, avatarUrl: file.uri };
  }

  async removeAvatar() {
    await wait(300);
    const me = this.me();
    const account = this.accounts.find((a) => a.id === me.id);
    if (account) account.avatarUrl = null;
    return { ...me, avatarUrl: null };
  }

  async changePassword(input: { currentPassword: string; newPassword: string }) {
    await wait(500);
    const me = this.me();
    const account = this.accounts.find((a) => a.id === me.id);
    if (!account || account.password !== input.currentPassword) throw new Error('Current password is incorrect');
    account.password = input.newPassword;
  }

  async listRooms() {
    await wait();
    return [...this.rooms].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)).map((r) => this.roomView(r));
  }

  async getRoom(id: string) {
    await wait(250);
    return this.roomView(this.find(id));
  }

  async createRoom(input: NewRoomInput) {
    await wait(700);
    const me = this.me();
    const course = input.courseId ? this.findCourse(input.courseId) : null;
    const room: StoredRoom = {
      id: uid(), title: input.title, subject: input.subject, startsAt: input.startsAt, durationMin: input.durationMin,
      invitedEmails: input.invitedEmails, joinCode: code(), teacher: { id: me.id, name: me.name },
      status: 'scheduled', isRecording: false, courseId: course?.id ?? null, courseTitle: course?.title ?? null,
    };
    this.rooms.push(room);
    return this.roomView(room);
  }

  async joinByCode(joinCode: string) {
    await wait(600);
    const room = this.rooms.find((r) => r.joinCode === joinCode.toUpperCase());
    if (!room) throw new Error('No class found with this code');
    if (room.status === 'ended') throw new Error('This class has ended');
    const me = this.me();
    if (room.teacher.id !== me.id) {
      (this.roomMembers[room.id] ??= new Set()).add(me.id);
      (this.rsvps[room.id] ??= {})[me.email.toLowerCase()] = 'accepted';
    }
    return this.roomView(room);
  }

  async startRoom(id: string) { await wait(300); return this.patch(id, { status: 'live' }); }
  async endRoom(id: string) { await wait(300); return this.patch(id, { status: 'ended', isRecording: false }); }

  async getJoinCredentials(): Promise<JoinCredentials> {
    // Mock mode never connects to a media server — the classroom renders a demo stage.
    return { serverUrl: '', token: '' };
  }

  async respondToRoom(id: string, response: Exclude<RsvpStatus, 'pending'>) {
    await wait(350);
    const room = this.find(id);
    const me = this.me();
    if (room.teacher.id === me.id) throw new Error("Teachers don't RSVP to their own class");
    (this.rsvps[id] ??= {})[me.email.toLowerCase()] = response;
    return this.roomView(room);
  }

  async listRoomStudents(id: string) {
    await wait(300);
    const room = this.find(id);
    if (room.teacher.id !== this.me().id) throw new Error('Only the teacher can do this');
    const course = room.courseId ? this.findCourse(room.courseId) : null;
    const emailOf = (userId: string) => this.accounts.find((a) => a.id === userId)?.email;

    // First source wins, so a student invited directly isn't relabelled by the course roster.
    const seen = new Map<string, RoomStudent['source']>();
    const add = (email: string | undefined, source: RoomStudent['source']) => {
      if (email && !seen.has(email.toLowerCase())) seen.set(email.toLowerCase(), source);
    };
    room.invitedEmails.forEach((e) => add(e, 'invite'));
    course?.invitedEmails.forEach((e) => add(e, 'course'));
    [...(course ? this.courseMembers[course.id] ?? [] : [])].forEach((u) => add(emailOf(u), 'course'));
    [...(this.roomMembers[id] ?? [])].forEach((u) => add(emailOf(u), 'code'));

    return [...seen].map(([email, source]): RoomStudent => {
      const account = this.accounts.find((a) => a.email === email);
      return {
        email, source, name: account?.name ?? null, userId: account?.id ?? null,
        status: this.rsvps[id]?.[email] ?? 'pending',
      };
    });
  }

  async startRecording(id: string) { await wait(400); return this.patch(id, { isRecording: true }); }

  async stopRecording(id: string) {
    await wait(400);
    const room = this.find(id);
    this.recordings.unshift({
      id: uid(), roomId: id, roomTitle: room.title, subject: room.subject,
      recordedAt: new Date().toISOString(), durationSec: 0, url: null, status: 'processing',
    });
    return this.patch(id, { isRecording: false });
  }

  // Mock mode has no media server, so there are no publish permissions to change.
  async setScreenShareGrant() { await wait(250); }
  async setScreenSharePolicy() { await wait(250); }
  async muteStudent() { await wait(250); }
  async muteAllStudents() { await wait(250); }

  async listRecordings() {
    await wait();
    return this.recordings.map((r) => ({ ...r }));
  }

  async listCourses() {
    await wait();
    return [...this.courses].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((c) => this.courseView(c));
  }

  async getCourse(id: string) {
    await wait(250);
    return this.courseView(this.findCourse(id));
  }

  async createCourse(input: NewCourseInput) {
    await wait(700);
    const me = this.me();
    const course: Course = {
      id: uid(), ...input, joinCode: code(), teacher: { id: me.id, name: me.name },
      memberCount: 0, roomCount: 0, createdAt: new Date().toISOString(),
    };
    this.courses.push(course);
    return this.courseView(course);
  }

  async inviteToCourse(id: string, emails: string[]) {
    await wait(400);
    const course = this.findCourse(id);
    for (const e of emails) {
      const email = e.trim().toLowerCase();
      if (!course.invitedEmails.includes(email)) course.invitedEmails.push(email);
    }
    return this.courseView(course);
  }

  async joinCourseByCode(joinCode: string) {
    await wait(600);
    const course = this.courses.find((c) => c.joinCode === joinCode.toUpperCase());
    if (!course) throw new Error('No course found with this code');
    const me = this.me();
    (this.courseMembers[course.id] ??= new Set()).add(me.id);
    return this.courseView(course);
  }

  async listCourseRooms(id: string) {
    await wait(250);
    this.findCourse(id); // 404s if missing
    return this.rooms.filter((r) => r.courseId === id).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)).map((r) => this.roomView(r));
  }

  private findDoc(id: string) {
    const doc = this.vaultDocuments.find((d) => d.id === id);
    if (!doc) throw new Error('Document not found');
    return doc;
  }

  async listMyVault() {
    await wait();
    const me = this.me();
    return this.vaultDocuments.filter((d) => d.owner.id === me.id).map((d) => ({ ...d }));
  }

  async listSharedWithMe() {
    await wait();
    const email = this.me().email.toLowerCase();
    return this.vaultDocuments
      .filter((d) => d.sharedEmails.includes(email))
      .map((d) => ({ ...d, sharedEmails: [], canManage: false }));
  }

  async getVaultDocument(id: string) {
    await wait(200);
    const doc = this.findDoc(id);
    const me = this.me();
    const owner = doc.owner.id === me.id;
    if (!owner && !doc.sharedEmails.includes(me.email.toLowerCase())) throw new Error("You don't have access to this document");
    return owner ? { ...doc } : { ...doc, sharedEmails: [], canManage: false };
  }

  async uploadVaultDocument(input: NewVaultDocumentInput) {
    await wait(600);
    const me = this.me();
    const doc: VaultDocument = {
      id: uid(), title: input.title?.trim() || input.name, folder: input.folder?.trim() || null,
      mimeType: input.mimeType, sizeBytes: 0, url: input.uri, createdAt: new Date().toISOString(),
      owner: { id: me.id, name: me.name }, sharedEmails: [], canManage: true,
    };
    this.vaultDocuments.unshift(doc);
    return { ...doc };
  }

  async shareVaultDocument(id: string, emails: string[]) {
    await wait(400);
    const doc = this.findDoc(id);
    for (const e of emails) {
      const email = e.trim().toLowerCase();
      if (!doc.sharedEmails.includes(email)) doc.sharedEmails.push(email);
    }
    return { ...doc };
  }

  async unshareVaultDocument(id: string, email: string) {
    await wait(300);
    const doc = this.findDoc(id);
    doc.sharedEmails = doc.sharedEmails.filter((e) => e !== email.trim().toLowerCase());
    return { ...doc };
  }

  async deleteVaultDocument(id: string) {
    await wait(300);
    this.findDoc(id); // 404s if missing
    this.vaultDocuments = this.vaultDocuments.filter((d) => d.id !== id);
  }

  /* ---------- Homework — backed by the on-device demo store ---------- */

  private findHomework(id: string) {
    const hw = useHomeworkStore.getState().homework.find((h) => h.id === id);
    if (!hw) throw new Error('Homework not found');
    return hw;
  }

  private homeworkView(h: Homework): Homework {
    const me = this.me();
    const store = useHomeworkStore.getState();
    const owner = this.findCourse(h.courseId).teacher.id === me.id;
    return {
      ...h,
      submissionCount: owner ? store.submissionsFor(h.id).length : null,
      mySubmittedAt: owner ? null : store.mySubmission(h.id, me.id)?.submittedAt ?? null,
    };
  }

  async listCourseHomework(courseId: string) {
    await wait(250);
    return useHomeworkStore.getState().byCourse(courseId).map((h) => this.homeworkView(h));
  }

  async getHomework(id: string) {
    await wait(200);
    return this.homeworkView(this.findHomework(id));
  }

  async assignHomework(courseId: string, input: { title: string; instructions: string; dueAt: string }) {
    await wait(400);
    const me = this.me();
    const course = this.findCourse(courseId);
    if (course.teacher.id !== me.id) throw new Error('Only the course teacher can do this');
    const hw = useHomeworkStore.getState().assign({ courseId, courseTitle: course.title, ...input }, { id: me.id, name: me.name });
    return this.homeworkView(hw);
  }

  async listHomeworkSubmissions(id: string) {
    await wait(250);
    return useHomeworkStore.getState().submissionsFor(id);
  }

  async getMySubmission(id: string) {
    await wait(200);
    return useHomeworkStore.getState().mySubmission(id, this.me().id) ?? null;
  }

  async submitHomework(id: string, input: SubmitHomeworkInput) {
    await wait(500);
    const me = this.me();
    const hw = this.findHomework(id);
    if (this.findCourse(hw.courseId).teacher.id === me.id) throw new Error("Teachers don't hand in their own homework");
    const store = useHomeworkStore.getState();
    const previous = store.mySubmission(id, me.id)?.attachment ?? null;
    const attachment = input.file ?? (input.keepAttachment ? previous : null);
    const sub = store.submit(id, { id: me.id, name: me.name }, { note: input.note, attachment });
    return { ...sub, late: new Date(sub.submittedAt) > new Date(hw.dueAt) };
  }

  /* ---------- Exams — backed by the on-device demo store, with the server's rules ---------- */

  private findExam(id: string) {
    const exam = useExamsStore.getState().exams.find((e) => e.id === id);
    if (!exam) throw new Error('Exam not found');
    return exam;
  }

  private findAttempt(id: string) {
    const attempt = useExamsStore.getState().attempts.find((a) => a.id === id);
    if (!attempt) throw new Error('Attempt not found');
    return attempt;
  }

  /** Same as the server: an attempt left running past its deadline (+15 s grace) ends as time_up. */
  private expire(exam: StoredExam, attempt: ExamAttempt) {
    if (!attempt.finish && Date.now() > attemptDeadline(exam, attempt) + 15_000) {
      useExamsStore.getState().finish(attempt.id, 'time_up');
      this.notifyFinished(exam, this.findAttempt(attempt.id));
      return this.findAttempt(attempt.id);
    }
    return attempt;
  }

  private attemptView(exam: StoredExam, attempt: ExamAttempt): ExamAttempt {
    const me = this.me();
    const visible = exam.teacher.id === me.id || (!!attempt.finish && (exam.showResults || !!attempt.finalizedAt));
    return {
      ...attempt,
      deadline: new Date(attemptDeadline(exam, attempt)).toISOString(),
      score: visible ? scoreAttempt(exam, attempt) : null,
    };
  }

  /** Same as the server: no questions before a student starts, no answer key until results are released. */
  private examView(exam: StoredExam): Exam {
    const me = this.me();
    const store = useExamsStore.getState();
    const owner = exam.teacher.id === me.id;
    const stored = owner ? undefined : store.attemptOf(exam.id, me.id);
    const mine = stored ? this.expire(exam, stored) : undefined;
    const visible = owner || (!!mine?.finish && exam.showResults);
    const questions = owner || visible ? exam.questions
      : mine ? exam.questions.map((q) => ({ ...q, correct: null }))
        : [];
    return {
      ...exam,
      questions,
      questionCount: exam.questions.length,
      totalPoints: exam.questions.reduce((sum, q) => sum + q.points, 0),
      myAttempt: mine ? this.attemptView(exam, mine) : owner ? undefined : null,
      submissionCount: owner ? store.attempts.filter((a) => a.examId === exam.id && a.finish).length : null,
      finalizedCount: owner ? store.attempts.filter((a) => a.examId === exam.id && a.finalizedAt).length : null,
    };
  }

  async listExams() {
    await wait(250);
    return [...useExamsStore.getState().exams]
      .sort((a, b) => +new Date(b.opensAt) - +new Date(a.opensAt))
      .map((e) => this.examView(e));
  }

  async listCourseExams(courseId: string) {
    return (await this.listExams()).filter((e) => e.courseId === courseId);
  }

  async getExam(id: string) {
    await wait(200);
    return this.examView(this.findExam(id));
  }

  async createExam(courseId: string, input: NewExamInput) {
    await wait(500);
    const me = this.me();
    const course = this.findCourse(courseId);
    if (course.teacher.id !== me.id) throw new Error('Only the course teacher can do this');
    const exam = useExamsStore.getState().create({ ...input, courseId, courseTitle: course.title }, { id: me.id, name: me.name });
    return this.examView(exam);
  }

  async deleteExam(id: string) {
    await wait(300);
    useExamsStore.getState().remove(this.findExam(id).id);
  }

  async startExam(id: string) {
    await wait(400);
    const me = this.me();
    const exam = this.findExam(id);
    if (exam.teacher.id === me.id) throw new Error("Teachers don't take their own exams");
    const window = examWindow(exam);
    if (window === 'upcoming') throw new Error("This exam hasn't opened yet");
    if (window === 'closed') throw new Error('This exam has closed');
    return this.attemptView(exam, useExamsStore.getState().start(id, { id: me.id, name: me.name }));
  }

  async listExamAttempts(examId: string) {
    await wait(250);
    const exam = this.findExam(examId);
    return useExamsStore.getState().attempts
      .filter((a) => a.examId === examId)
      .map((a) => this.attemptView(exam, this.expire(exam, a)));
  }

  async getExamAttempt(id: string) {
    await wait(200);
    const attempt = this.findAttempt(id);
    const exam = this.findExam(attempt.examId);
    return this.attemptView(exam, this.expire(exam, attempt));
  }

  async saveExamAnswer(attemptId: string, questionId: string, value: ExamAnswer | null) {
    const attempt = this.findAttempt(attemptId);
    const exam = this.findExam(attempt.examId);
    if (this.expire(exam, attempt).finish) throw new Error('This attempt is finished and can’t be changed');
    useExamsStore.getState().answer(attemptId, questionId, value);
    return this.attemptView(exam, this.findAttempt(attemptId));
  }

  async finishExamAttempt(attemptId: string, reason: 'submitted' | 'left') {
    await wait(300);
    const attempt = this.findAttempt(attemptId);
    const exam = this.findExam(attempt.examId);
    const late = Date.now() > attemptDeadline(exam, attempt);
    if (!attempt.finish) {
      useExamsStore.getState().finish(attemptId, late ? 'time_up' : reason);
      this.notifyFinished(exam, this.findAttempt(attemptId));
    }
    return this.attemptView(exam, this.findAttempt(attemptId));
  }

  async gradeExamAnswer(attemptId: string, questionId: string, points: number) {
    await wait(150);
    const attempt = this.findAttempt(attemptId);
    const exam = this.findExam(attempt.examId);
    const q = exam.questions.find((x) => x.id === questionId);
    if (!q || q.kind !== 'written') throw new Error('Only written answers are graded by hand');
    if (points < 0 || points > q.points) throw new Error(`This question is worth at most ${q.points} points`);
    if (attempt.finalizedAt) throw new Error('This grade is final. Reopen it to change it');
    useExamsStore.getState().grade(attemptId, questionId, points);
    return this.attemptView(exam, this.findAttempt(attemptId));
  }

  /** Same messages as the server's ExamNotifier. */
  private notifyFinished(exam: StoredExam, attempt: ExamAttempt) {
    const who = attempt.student.name;
    const title = attempt.finish === 'time_up' ? `Time ran out for ${who} on “${exam.title}”`
      : attempt.finish === 'left' ? `${who} left “${exam.title}”`
      : `${who} submitted “${exam.title}”`;
    const { ungraded, grade, scale } = scoreAttempt(exam, attempt);
    const next = ungraded ? `${ungraded} written ${ungraded === 1 ? 'answer' : 'answers'} to grade` : `Auto-graded ${formatGrade(grade)}/${scale} · ready to finalize`;
    useDemoNotifications.getState().add(exam.teacher.id, {
      kind: 'exam_submitted', title, body: `${exam.courseTitle} · ${next}`, link: `/exam/attempt/${attempt.id}`,
    });
  }

  private ownedFinishedAttempt(attemptId: string) {
    const attempt = this.findAttempt(attemptId);
    const exam = this.findExam(attempt.examId);
    if (exam.teacher.id !== this.me().id) throw new Error('Only the course teacher can do this');
    if (!this.expire(exam, attempt).finish) throw new Error('Wait until the student has finished');
    return { exam, attempt: this.findAttempt(attemptId) };
  }

  private finalize(exam: StoredExam, attempt: ExamAttempt) {
    useExamsStore.getState().setFinalized(attempt.id, new Date().toISOString());
    const { grade, scale } = scoreAttempt(exam, attempt);
    useDemoNotifications.getState().add(attempt.student.id, {
      kind: 'exam_graded', title: `Your grade for “${exam.title}”: ${formatGrade(grade)}/${scale}`,
      body: `${exam.courseTitle} · Graded by ${exam.teacher.name}`, link: `/exam/${exam.id}`,
    });
  }

  async finalizeExamAttempt(attemptId: string) {
    await wait(200);
    const { exam, attempt } = this.ownedFinishedAttempt(attemptId);
    if (!attempt.finalizedAt) {
      const { ungraded } = scoreAttempt(exam, attempt);
      if (ungraded) throw new Error(`Grade every written answer first (${ungraded} left)`);
      this.finalize(exam, attempt);
    }
    return this.attemptView(exam, this.findAttempt(attemptId));
  }

  async reopenExamAttempt(attemptId: string) {
    await wait(150);
    const { exam } = this.ownedFinishedAttempt(attemptId);
    useExamsStore.getState().setFinalized(attemptId, null);
    return this.attemptView(exam, this.findAttempt(attemptId));
  }

  async finalizeAllExamAttempts(examId: string) {
    await wait(300);
    const exam = this.findExam(examId);
    if (exam.teacher.id !== this.me().id) throw new Error('Only the course teacher can do this');
    for (const stored of useExamsStore.getState().attempts.filter((a) => a.examId === examId)) {
      const a = this.expire(exam, stored);
      if (a.finish && !a.finalizedAt && !scoreAttempt(exam, a).ungraded) this.finalize(exam, a);
    }
    return this.listExamAttempts(examId);
  }

  /* ---------- Notifications — on this device ---------- */

  async listNotifications(): Promise<Inbox> {
    const me = this.me();
    const mine = useDemoNotifications.getState().items.filter((n) => n.recipientId === me.id);
    return {
      items: mine.slice(0, 50).map(({ recipientId: _, ...n }) => n),
      unread: mine.filter((n) => !n.readAt).length,
    };
  }

  async markNotificationRead(id: string) {
    useDemoNotifications.getState().markRead(id);
  }

  async markAllNotificationsRead() {
    useDemoNotifications.getState().markAllRead(this.me().id);
  }

  // Demo mode has no server to push from: the bell and the list still work.
  async registerPushToken() {}
  async removePushToken() {}

  /* ---------- Class chat history — in memory ---------- */

  private messages: Record<string, StoredChatMessage[]> = {};

  async listRoomMessages(roomId: string) {
    return [...(this.messages[roomId] ?? [])];
  }

  async postRoomMessage(roomId: string, message: { id: string; text: string }) {
    const me = this.me();
    const list = (this.messages[roomId] ??= []);
    const existing = list.find((m) => m.id === message.id);
    if (existing) return existing;
    const stored: StoredChatMessage = {
      id: message.id, authorId: me.id, author: me.name, teacher: this.find(roomId).teacher.id === me.id,
      text: message.text, at: Date.now(),
    };
    list.push(stored);
    return stored;
  }
}

export const api: Api = config.useMock ? new MockApi() : new HttpApi();
