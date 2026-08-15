import { useEffect, useState } from "preact/hooks";
import themeStyles from "../shared/theme.css?inline";
import { shouldShowCameraOverlay } from "../shared/camera";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
} from "../shared/storage";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  type DayState,
  type Settings,
  remainingAllowanceMs,
} from "../shared/types";
import { BreaktimeOverlay } from "./BreaktimeOverlay";
import { CameraOverlay } from "./CameraOverlay";
import { DimOverlay } from "./DimOverlay";
import { ExtensionFrame } from "./ExtensionFrame";
import { ExtensionLinkLock } from "./ExtensionLinkLock";
import { PeekOverlay } from "./PeekOverlay";
import { SleepClock } from "./SleepClock";
import { UsageClock } from "./UsageClock";
import { RemainingTimeOverlay } from "./RemainingTimeOverlay";
import { AccessInProgressOverlay } from "./AccessInProgressOverlay";

interface Props {
  matchedDomain: string | null;
}

/**
 * Top-level renderer inside the Shadow DOM root. The shadow root is mounted
 * on every page (universal content script); this component decides which
 * overlays to show:
 *   - `UsageClock`: only on tracked sites.
 *   - `SleepClock`: every site, but only inside the 10h-before-wakeup window.
 *   - `PeekOverlay`: only on untracked sites when Peek is enabled.
 *   - `ExtensionFrame`: tracked sites during the two-minute extension or
 *     after the popup lock is overridden.
 *   - `BreaktimeOverlay`: all tracked sites while the global allowance break
 *     is open.
 *   - `RemainingTimeOverlay`: pauses a resumed allowance until acknowledged.
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    void getSettings().then(setSettings);
    return onSettingsChange(setSettings);
  }, []);

  useEffect(() => {
    if (state.accessFlowPhase !== "resumePrompt") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.accessFlowPhase]);
  const extensionFrameVisible =
    matchedDomain !== null &&
    (state.breaktimeExtensionExpiresAt !== null ||
      (state.popupDoneToday && state.surveyContinueAllowed));

  return (
    <>
      <style>{themeStyles}</style>
      {extensionFrameVisible && <ExtensionFrame />}
      {(matchedDomain !== null || settings.alwaysShowTimer) && (
        <UsageClock matchedDomain={matchedDomain} alwaysShowTimer={settings.alwaysShowTimer} />
      )}
      {shouldShowCameraOverlay(matchedDomain, settings, state) && (
        <CameraOverlay permission={settings.cameraOverlayPermission} />
      )}
      <SleepClock />
      {matchedDomain === null && settings.peekEnabled && (
        <PeekOverlay trackedSites={settings.trackedSites} />
      )}
      <DimOverlay state={state} matchedDomain={matchedDomain} />
      {matchedDomain !== null && state.breaktimeExtensionExpiresAt !== null && (
        <ExtensionLinkLock />
      )}
      {matchedDomain !== null && state.accessFlowPhase === "break" && <BreaktimeOverlay />}
      {matchedDomain !== null && state.accessFlowPhase === "resumePrompt" && (
        <RemainingTimeOverlay remainingMs={remainingAllowanceMs(state, now)} />
      )}
      {matchedDomain !== null &&
        (state.accessFlowPhase === "challenge" || state.accessFlowPhase === "picking") && (
          <AccessInProgressOverlay challengeActive={state.accessFlowPhase === "challenge"} />
        )}
    </>
  );
}
