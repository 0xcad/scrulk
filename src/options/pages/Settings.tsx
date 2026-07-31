import { useEffect, useState } from "preact/hooks";
import { TrackedSitesList } from "../components/TrackedSitesList";
import { NumberField } from "../components/NumberField";
import { getSettings, onSettingsChange, setSettings } from "../../shared/storage";
import type { CameraOverlayPermission } from "../../shared/types";

export function Settings() {
  return (
    <>
      <section>
        <h2>Tracked websites</h2>
        <TrackedSitesList />
      </section>

      <section>
        <h2>Wake up time</h2>
        <p>
          What time do you usually have to wake up? Daily usage resets when you need to wake up, not midnight.
        </p>
        <WakeUpTimeField />
      </section>

      <section>
        <h2>Breaktime</h2>
        <p>
          After this many minutes of accumulated tracked usage, you'll get an
          alert prompting you to take a break.
        </p>
        <NumberField
          field="breaktimeMinutes"
          label="Alert every"
          min={1}
          max={240}
          hint="minutes"
        />
      </section>

      <section>
        <h2>Tab limit</h2>
        <p>
          You can only open this many tabs of track websites at once.
        </p>
        <NumberField
          field="tabLimit"
          label="Max tracked tabs"
          min={1}
          max={20}
        />
      </section>

      <section>
        <h2>Always show timer</h2>
        <p>
          Show your total time on all websites, even when the current site is not tracked.
        </p>
        <AlwaysShowTimerField />
      </section>

      <section>
        <h2>Camera overlay</h2>
        <p>
          Show a small mirrored view of yourself on tracked websites. Scroll
          Unlock requests video-only access; the website never receives your
          camera stream.
        </p>
        <CameraOverlayField />
      </section>

    </>
  );
}

function CameraOverlayField() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<CameraOverlayPermission>("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setEnabled(s.cameraOverlayEnabled);
      setPermission(s.cameraOverlayPermission);
    });
    return onSettingsChange((s) => {
      setEnabled(s.cameraOverlayEnabled);
      setPermission(s.cameraOverlayPermission);
    });
  }, []);

  const requestCamera = async () => {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      await setSettings({ cameraOverlayPermission: "granted" });
    } catch {
      setPermission("denied");
      await setSettings({ cameraOverlayPermission: "denied" });
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
          onChange={(e) => {
            const next = (e.target as HTMLInputElement).checked;
            setEnabled(next);
            void setSettings({ cameraOverlayEnabled: next });
            if (next) void requestCamera();
          }}
        />
      </label>
      <small class={permission === "denied" ? "error" : undefined}>{status}</small>
      {enabled && permission === "denied" && (
        <button type="button" disabled={busy} onClick={() => void requestCamera()}>
          {busy ? "requesting…" : "retry camera access"}
        </button>
      )}
    </div>
  );
}

function AlwaysShowTimerField() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setEnabled(s.alwaysShowTimer));
    return onSettingsChange((s) => setEnabled(s.alwaysShowTimer));
  }, []);

  if (enabled === null) return <p>Loading…</p>;

  return (
    <label class="row">
      <span>Always show timer</span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).checked;
          setEnabled(next);
          void setSettings({
            alwaysShowTimer: next,
            ...(next ? {} : { alwaysShowTimerExpanded: false }),
          });
        }}
      />
      <small>Also records and displays total time on all websites.</small>
    </label>
  );
}

function WakeUpTimeField() {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((s) => setValue(s.wakeUpTime));
    return onSettingsChange((s) => setValue(s.wakeUpTime));
  }, []);

  if (value === null) return <p>Loading…</p>;

  const commit = async (next: string) => {
    if (!/^\d{2}:\d{2}$/.test(next)) {
      const current = await getSettings();
      setValue(current.wakeUpTime);
      return;
    }
    await setSettings({ wakeUpTime: next });
  };

  return (
    <label class="row">
      <span>Wake up time</span>
      <input
        type="time"
        value={value}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).value;
          setValue(next);
          void commit(next);
        }}
      />
      <small>Local time. Day boundary for usage totals.</small>
    </label>
  );
}
