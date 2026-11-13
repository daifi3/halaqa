/** This phone's Expo push token once lib/push.ts has registered it (kept apart to avoid an import cycle with api.ts). */
let current: string | null = null;

export const getPushToken = () => current;
export const setPushToken = (token: string | null) => { current = token; };
