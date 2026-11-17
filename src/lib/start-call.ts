import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useChats } from '@/store/chats';
import { api } from './api';
import type { Person } from './types';

/** Rings someone and opens the call screen. */
export async function startCall(person: Person) {
  try {
    const call = await api.startCall(person.id);
    router.push(`/call/${call.id}`);
  } catch (e) {
    Alert.alert('Couldn’t call', e instanceof Error ? e.message : 'Please try again.');
  }
}

/** Opens (or starts) the chat with someone. */
export async function openChatWith(person: Person) {
  try {
    const c = await api.openChat(person.id);
    useChats.getState().upsertConversation(c);
    router.push({ pathname: '/chat/[id]', params: { id: c.id } });
  } catch (e) {
    Alert.alert('Couldn’t open the chat', e instanceof Error ? e.message : 'Please try again.');
  }
}
