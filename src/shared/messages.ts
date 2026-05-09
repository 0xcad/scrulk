/**
 * Typed messages between content scripts / extension pages and the background.
 * Background never pushes state via messages — clients react to
 * storage.onChanged for that. Messages are reserved for *commands* the
 * background must execute on behalf of a client (closing tabs, advancing
 * the breaktime cycle, persisting a survey).
 */

import type { Regret } from "./history";

export type Message =
  | { type: "breaktime:done" } // user clicked "I'm done!" — close all tracked tabs + open survey
  | { type: "breaktime:resume" } // user completed the hold challenge
  | {
      type: "survey:submit";
      date: string; // 'YYYY-MM-DD'
      regret: Regret;
      notes: string;
    }
  | {
      type: "survey:open";
      date: string; // 'YYYY-MM-DD'; opens survey page in a new tab
      closeTrackedTabs?: boolean; // re-entry "edit survey" sets this true
    }
  | { type: "missed:dismiss" };

export type MessageType = Message["type"];
