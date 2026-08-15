import { useEffect, useState } from "preact/hooks";
import { sendCommand } from "../../shared/messages";
import type { CameraOverlayPermission } from "../../shared/settings";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";

export function CameraSettingsField() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<CameraOverlayPermission>("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSettings().then((settings) => {
      setEnabled(settings.cameraOverlayEnabled);
      setPermission(settings.cameraOverlayPermission);
    });
    return onSettingsChange((settings) => {
      setEnabled(settings.cameraOverlayEnabled);
      setPermission(settings.cameraOverlayPermission);
    });
  }, []);

  const openCameraHub = async () => {
    setBusy(true);
    try {
      await sendCommand({ type: "camera:enable" });
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) return <p>Loading…</p>;

  const status = permission === "denied"
    ? "Camera access is unavailable. Check Firefox’s camera permission for Scroll Unlock, then retry."
    : permission === "granted"
      ? "Camera access is ready. The preview appears only on tracked websites."
      : "Camera access has not been requested yet.";

  return (
    <div class="camera-setting">
      <label class="row">
        <span>Show camera overlay</span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => {
            const next = (event.target as HTMLInputElement).checked;
            setEnabled(next);
            void (async () => {
              await setSettings({
                cameraOverlayEnabled: next,
                ...(next ? {} : { cameraOverlayPermission: "unknown" }),
              });
              await sendCommand({
                type: next ? "camera:enable" : "camera:disable",
              });
            })();
          }}
        />
      </label>
      <small class={permission === "denied" ? "error" : undefined}>{status}</small>
      {enabled && permission === "denied" && (
        <button type="button" disabled={busy} onClick={() => void openCameraHub()}>
          {busy ? "opening…" : "retry camera access"}
        </button>
      )}
    </div>
  );
}
