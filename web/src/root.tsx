import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider, useLocation } from 'react-router';
import { BiometricGate } from '@/components/biometric-gate';
import { DialogHost } from '@/components/dialog-host';
import { TabsLayout } from '@/components/tab-bar';
import { Spinner } from '@/components/ui/misc';
import { useSession } from '@/store/session';
import Home from './app/tabs/home';
import Courses from './app/tabs/courses';
import Exams from './app/tabs/exams';
import Recordings from './app/tabs/recordings';
import Profile from './app/tabs/profile';
import Welcome from './app/welcome';
import LogIn from './app/log-in';
import SignUp from './app/sign-up';

// Every other screen loads on first visit, so the first page stays light.
const RoomDetails = lazy(() => import('./app/room/details'));
const RoomStudents = lazy(() => import('./app/room/students'));
const NewRoom = lazy(() => import('./app/room/new'));
const Join = lazy(() => import('./app/join'));
const Scan = lazy(() => import('./app/scan'));
const CourseDetails = lazy(() => import('./app/course/details'));
const NewCourse = lazy(() => import('./app/course/new'));
const JoinCourse = lazy(() => import('./app/course/join'));
const Classroom = lazy(() => import('./app/classroom'));
const RecordingPlayer = lazy(() => import('./app/recording'));
const Vault = lazy(() => import('./app/vault/index'));
const VaultDocument = lazy(() => import('./app/vault/document'));
const VaultUpload = lazy(() => import('./app/vault/upload'));
const Viewer = lazy(() => import('./app/viewer'));
const ChangePassword = lazy(() => import('./app/change-password'));
const Notifications = lazy(() => import('./app/notifications'));
const Inbox = lazy(() => import('./app/inbox'));
const NewHomework = lazy(() => import('./app/homework/new'));
const HomeworkDetails = lazy(() => import('./app/homework/details'));
const NewExam = lazy(() => import('./app/exam/new'));
const ExamDetails = lazy(() => import('./app/exam/details'));
const TakeExam = lazy(() => import('./app/exam/take'));
const AttemptDetails = lazy(() => import('./app/exam/attempt'));

/** Signed-in screens. A link opened while signed out (e.g. a join QR) comes back here after signing in. */
function Protected({ children }: { children: ReactNode }) {
  const signedIn = useSession((s) => !!s.user);
  const location = useLocation();
  if (!signedIn) return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

/** Welcome, sign-up and log-in. Signing in moves on to where the user was headed. */
function GuestOnly({ children }: { children: ReactNode }) {
  const signedIn = useSession((s) => !!s.user);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (signedIn) return <Navigate to={from && from !== '/welcome' ? from : '/'} replace />;
  return children;
}

function Loading() {
  return (
    <div className="v center" style={{ minHeight: '60vh' }}>
      <Spinner />
    </div>
  );
}

/** Wraps every screen: lazy-loading fallback, the device lock and the dialog host. */
function Shell() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
      <BiometricGate />
      <DialogHost />
    </>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Shell />}>
      <Route path="/welcome" element={<GuestOnly><Welcome /></GuestOnly>} />
      <Route path="/sign-up" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/log-in" element={<GuestOnly><LogIn /></GuestOnly>} />

      {/* The signed-in app: the tab bar (phones) or the sidebar (desktop) around each page. */}
      <Route element={<Protected><TabsLayout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="courses" element={<Courses />} />
        <Route path="exams" element={<Exams />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="profile" element={<Profile />} />

        <Route path="/room/new" element={<NewRoom />} />
        <Route path="/room/:id" element={<RoomDetails />} />
        <Route path="/room/students/:id" element={<RoomStudents />} />
        <Route path="/join" element={<Join />} />
        <Route path="/course/new" element={<NewCourse />} />
        <Route path="/course/join" element={<JoinCourse />} />
        <Route path="/course/:id" element={<CourseDetails />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/vault/upload" element={<VaultUpload />} />
        <Route path="/vault/:id" element={<VaultDocument />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/homework/new" element={<NewHomework />} />
        <Route path="/homework/:id" element={<HomeworkDetails />} />
        <Route path="/exam/new" element={<NewExam />} />
        <Route path="/exam/attempt/:id" element={<AttemptDetails />} />
        <Route path="/exam/:id" element={<ExamDetails />} />
      </Route>

      {/* Full-window screens: the live class, taking an exam, the camera, players and viewers. */}
      <Route path="/classroom/:id" element={<Protected><Classroom /></Protected>} />
      <Route path="/exam/take/:id" element={<Protected><TakeExam /></Protected>} />
      <Route path="/scan" element={<Protected><Scan /></Protected>} />
      <Route path="/recording/:id" element={<Protected><RecordingPlayer /></Protected>} />
      <Route path="/viewer" element={<Protected><Viewer /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ),
);

export function App() {
  return <RouterProvider router={router} />;
}
