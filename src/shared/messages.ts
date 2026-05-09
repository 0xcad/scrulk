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
    }
  | {
      type: "survey:redirect";
      date: string; // 'YYYY-MM-DD'; close sender tab + open survey for date
    }
  | { type: "survey:continue" } // survey page → background; allow tracked tabs again
  | { type: "missed:dismiss" };

export type MessageType = Message["type"];
