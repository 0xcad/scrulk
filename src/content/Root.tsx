import { useEffect, useState } from "preact/hooks";
import themeStyles from "../shared/theme.css?inline";
import { shouldShowCameraOverlay } from "../features/camera/camera";
import {
  getDayState,
  getSettings,
  onDayStateChange,
  onSettingsChange,
  onFocusSessionsChange,
} from "../shared/storage";
import {
  DEFAULT_DAY_STATE,
  type DayState,
  remainingAllowanceMs,
} from "../shared/dayState";
import { DEFAULT_SETTINGS, type Settings } from "../shared/settings";
import { BreaktimeOverlay } from "../features/access-flow/content/BreaktimeOverlay";
import { CameraOverlay } from "../features/camera/CameraOverlay";
import { DimOverlay } from "../features/access-flow/content/DimOverlay";
import { ExtensionFrame } from "../features/access-flow/content/ExtensionFrame";
import { ExtensionLinkLock } from "../features/peek/content/ExtensionLinkLock";
import { PeekOverlay } from "../features/peek/content/PeekOverlay";
import { SleepClock } from "./SleepClock";
import { UsageClock } from "../features/tracking/content/UsageClock";
import { RemainingTimeOverlay } from "../features/access-flow/content/RemainingTimeOverlay";
import { AccessInProgressOverlay } from "../features/access-flow/content/AccessInProgressOverlay";
import { sendCommand } from "../shared/messages";

interface Props {
  matchedDomain: string | null;
}

export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(Date.now());
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    const sync = () => {
      void sendCommand({ type: "focus:getContext" }).then((value) => {
        setFocusMode(value === true);
      });
    };
    sync();
    const off = onFocusSessionsChange(sync);
    return off;
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
      {!focusMode && (matchedDomain !== null || settings.alwaysShowTimer) && (
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
