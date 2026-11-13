import { CodeJoin } from '@/components/code-join';
import { api } from '@/lib/api';

export default function JoinCourse() {
  return (
    <CodeJoin
      title="Join a course"
      button="Join course"
      demoCode="ALGO9X"
      join={async (code) => `/course/${(await api.joinCourseByCode(code)).id}`}
    />
  );
}
