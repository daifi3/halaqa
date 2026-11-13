// Demo mode only: the notifications MockApi hands out, kept on this device.
// With the real backend they live on the server (GET /api/notifications).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppNotification } from '@/lib/types';

type Stored = AppNotification & { recipientId: string };

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

interface DemoNotificationsState {
  items: Stored[];
  add: (recipientId: string, n: Pick<AppNotification, 'kind' | 'title' | 'body' | 'link'>) => void;
  markRead: (id: string) => void;
  markAllRead: (recipientId: string) => void;
}

export const useDemoNotifications = create<DemoNotificationsState>()(
  persist(
    (set) => ({
      items: [
        {
          id: 'n1', recipientId: 't-demo', kind: 'exam_submitted', title: 'Lina Mansouri submitted “Midterm: trees & graphs”',
          body: 'Algorithms & Data Structures · 1 written answer to grade', link: '/exam/attempt/at3', createdAt: ago(1.2), readAt: null,
        },
        {
          id: 'n2', recipientId: 't-demo', kind: 'exam_submitted', title: 'Time ran out for Karim Haddad on “Diagnostic: complexity basics”',
          body: 'Algorithms & Data Structures · 1 written answer to grade', link: '/exam/attempt/at2', createdAt: ago(169.85), readAt: ago(150),
        },
        {
          id: 'n3', recipientId: 's-demo', kind: 'exam_graded', title: 'Your grade for “Diagnostic: complexity basics”: 20/20',
          body: 'Algorithms & Data Structures · Graded by Dr. Amrani', link: '/exam/ex3', createdAt: ago(140), readAt: null,
        },
      ],
      add: (recipientId, n) => set((s) => ({
        items: [{ ...n, id: uid(), recipientId, createdAt: new Date().toISOString(), readAt: null }, ...s.items],
      })),
      markRead: (id) => set((s) => ({
        items: s.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      })),
      markAllRead: (recipientId) => set((s) => ({
        items: s.items.map((n) => (n.recipientId === recipientId && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      })),
    }),
    { name: 'halaqa-demo-notifications', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
