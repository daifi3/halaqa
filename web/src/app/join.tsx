import { CodeJoin } from '@/components/code-join';
import { api } from '@/lib/api';

export default function Join() {
  return (
    <CodeJoin
      title="Join a class"
      button="Join class"
      demoCode="OOP24K"
      join={async (code) => `/room/${(await api.joinByCode(code)).id}`}
    />
  );
}
