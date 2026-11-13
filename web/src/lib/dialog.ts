import { create } from 'zustand';

/**
 * The web counterpart of React Native's Alert.alert: a styled modal dialog with
 * the same title / message / buttons shape, so screens read the same as on mobile.
 */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface DialogState {
  queue: Dialog[];
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useDialogs = create<DialogState>()((set) => ({
  queue: [],
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((d) => d.id !== id) })),
}));

export function alert(title: string, message?: string, buttons: DialogButton[] = [{ text: 'OK' }]) {
  const dialog: Dialog = { id: nextId++, title, message, buttons: buttons.length ? buttons : [{ text: 'OK' }] };
  useDialogs.setState((s) => ({ queue: [...s.queue, dialog] }));
}
