/**
 * Typed messages between content scripts and the background. Background never
 * pushes state via messages — content scripts react to storage.onChanged for
 * that. Messages are reserved for *commands* the background must execute on
 * behalf of a content script (closing a tab, advancing the breaktime cycle).
 */

export type Message =
  | { type: "breaktime:done" } // user clicked "I'm done!" — close all tracked tabs
  | { type: "breaktime:resume" }; // user completed the hold challenge

export type MessageType = Message["type"];
