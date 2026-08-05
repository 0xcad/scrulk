import { useEffect, useRef, useState } from "preact/hooks";
import browser from "webextension-polyfill";
import themeStyles from "../shared/theme.css?inline";
import type { Message } from "../shared/messages";
import { shouldShowCameraOverlay } from "../shared/camera";
import {
  getDayState,
  getGatewayState,
  getSettings,
  onDayStateChange,
  onGatewayStateChange,
  onSettingsChange,
} from "../shared/storage";
import {
  DEFAULT_DAY_STATE,
  DEFAULT_SETTINGS,
  type DayState,
  type GatewayState,
  type Settings,
} from "../shared/types";
import { BreaktimeOverlay } from "./BreaktimeOverlay";
import { CameraOverlay } from "./CameraOverlay";
import { DimOverlay } from "./DimOverlay";
import { ExtensionFrame } from "./ExtensionFrame";
import { ExtensionLinkLock } from "./ExtensionLinkLock";
import { GatewayExpiredOverlay } from "./GatewayExpiredOverlay";
import { PeekOverlay } from "./PeekOverlay";
import { SleepClock } from "./SleepClock";
import { UsageClock } from "./UsageClock";

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
 *   - `ExtensionFrame`: only on tracked sites during extended time or after
 *     post-survey access has been approved.
 *   - `BreaktimeOverlay`: only on tracked sites, only while the global
 *     `breaktimeOpen` flag is set.
 *   - `GatewayExpiredOverlay`: only on tracked sites, only while
 *     `gatewayState[domain].expiredAlertActive` is true. Rendered only when
 *     the tab is visible (background tabs mount the state but defer paint
 *     until focus).
 *
 * Post-survey redirect: when the survey has already been submitted for the
 * current wake-day and the user has not yet clicked "Continue" on the
 * survey page, any tracked-tab visit fires a one-shot `survey:redirect`
 * which closes this tab and opens the survey.
 */
export function Root({ matchedDomain }: Props) {
  const [state, setState] = useState<DayState>(DEFAULT_DAY_STATE);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [gateway, setGateway] = useState<GatewayState>({});
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true,
  );
  const redirectSent = useRef(false);

  useEffect(() => {
    void getDayState().then(setState);
    return onDayStateChange(setState);
  }, []);

  useEffect(() => {
    void getSettings().then(setSettings);
    return onSettingsChange(setSettings);
  }, []);

  useEffect(() => {
    void getGatewayState().then(setGateway);
    return onGatewayStateChange(setGateway);
  }, []);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (
      matchedDomain === null ||
      state.surveyFilledFor === null ||
      state.surveyContinueAllowed ||
      state.breaktimeOpen ||
      redirectSent.current
    ) {
      return;
    }
    redirectSent.current = true;
    const msg: Message = {
      type: "survey:redirect",
      date: state.surveyFilledFor,
    };
    void browser.runtime.sendMessage(msg).catch(() => null);
  }, [
    matchedDomain,
    state.surveyFilledFor,
    state.surveyContinueAllowed,
    state.breaktimeOpen,
  ]);

  const expiredAlertForDomain =
    matchedDomain !== null &&
    gateway[matchedDomain]?.expiredAlertActive === true;
  const extensionFrameVisible =
    matchedDomain !== null &&
    (state.breaktimeExtensionExpiresAt !== null ||
      state.surveyContinueAllowed);

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
      <DimOverlay state={state} settings={settings} gateway={gateway} matchedDomain={matchedDomain} />
      {matchedDomain !== null && state.breaktimeExtensionExpiresAt !== null && (
        <ExtensionLinkLock />
      )}
      {matchedDomain !== null && state.breaktimeOpen && <BreaktimeOverlay />}
      {matchedDomain !== null &&
        expiredAlertForDomain &&
        !state.breaktimeOpen &&
        visible && <GatewayExpiredOverlay domain={matchedDomain} />}
    </>
  );
}
