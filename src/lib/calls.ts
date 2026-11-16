import type { Call } from './types';

/** How often an open app checks for calls ringing for it. */
export const INCOMING_POLL_MS = 4000;
/** How often the call screen checks whether the other side answered or hung up. */
export const CALL_POLL_MS = 1500;

/** The other person on the call, from your side. */
export const otherParty = (call: Call) => (call.outgoing ? call.callee : call.caller);

/** Talk time in seconds, once a call was answered. */
export function callSeconds(call: Call, now = Date.now()) {
  if (!call.answeredAt) return 0;
  const end = call.endedAt ? Date.parse(call.endedAt) : now;
  return Math.max(0, Math.round((end - Date.parse(call.answeredAt)) / 1000));
}

export function formatCallLength(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** A missed call is one that rang for you and nobody picked up. */
export const isMissed = (call: Call) => !call.outgoing && (call.status === 'missed' || (call.status === 'cancelled' && !call.answeredAt));

/** One line for the call history: "Outgoing · 4:12", "Missed", "Declined"… */
export function describeCall(call: Call) {
  if (call.answeredAt && (call.status === 'ended' || call.status === 'accepted')) {
    return `${call.outgoing ? 'Outgoing' : 'Incoming'} · ${formatCallLength(callSeconds(call))}`;
  }
  if (isMissed(call)) return 'Missed call';
  switch (call.status) {
    case 'ringing': return call.outgoing ? 'Calling…' : 'Ringing';
    case 'declined': return call.outgoing ? 'Declined' : 'You declined';
    case 'missed': return 'No answer';
    case 'cancelled': return 'Cancelled';
    default: return call.outgoing ? 'Outgoing' : 'Incoming';
  }
}

/** What the call screen says when a call is over. */
export function endedLabel(call: Call) {
  switch (call.status) {
    case 'declined': return call.outgoing ? `${call.callee.name} declined the call` : 'Call declined';
    case 'missed': return call.outgoing ? 'No answer' : 'Missed call';
    case 'cancelled': return 'Call cancelled';
    default: return call.answeredAt ? `Call ended · ${formatCallLength(callSeconds(call))}` : 'Call ended';
  }
}

export const callIsOver = (call: Call) => call.status !== 'ringing' && call.status !== 'accepted';
