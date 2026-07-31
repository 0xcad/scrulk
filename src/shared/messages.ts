/**
 * Typed messages between content scripts / extension pages and the background.
 * Background never pushes state via messages — clients react to
 * storage.onChanged for that. Messages are reserved for *commands* the
 * background must execute on behalf of a client (closing tabs, advancing
 * the breaktime cycle, persisting a survey).
 */

export type Message =
  | { type: "breaktime:done" } // user clicked "I'm done!" — close all tracked tabs + open survey
  | { type: "breaktime:openChallenge" } // alert overlay → extension-origin camera + hold page
  | { type: "breaktime:resume" } // user completed the hold challenge
  | { type: "breaktime:extend" } // user gets one two-minute extension for this cycle
  | {
      type: "survey:submit";
      date: string; // 'YYYY-MM-DD'
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
  | {
      // gateway page → background: user picked an N-minute timer for `domain`.
      // Background sets timer + alarm and navigates this tab to `destUrl`.
      type: "gateway:startTimer";
      domain: string;
      minutes: number;
      destUrl: string;
    }
  | {
      // gateway page → background: user chose to go back; navigate this tab
      // to its last-known untracked URL (or close / about:newtab fallback).
      type: "gateway:goBack";
    }
  | {
      // expired overlay → background: user picked "I'm done". Resets state
      // for `domain` and back-navigates every tab on that domain.
      type: "gateway:imDone";
      domain: string;
    }
  | {
      // expired overlay → background: user finished the journal. Sets the
      // per-domain CONTINUE flag so subsequent loads bypass the gateway.
      type: "gateway:setContinue";
      domain: string;
    };

export type MessageType = Message["type"];
