import { TrackedSitesList } from "../components/TrackedSitesList";
import { NumberField } from "../components/NumberField";

export function Settings() {
  return (
    <>
      <section>
        <h2>Tracked websites</h2>
        <p>
          Adding a domain tracks it and all its subdomains. Subdomains under a
          tracked domain count as the same site.
        </p>
        <TrackedSitesList />
      </section>

      <section>
        <h2>Day boundary</h2>
        <p>
          The day runs from your wake-up time to the next day's wake-up time.
          Usage and (later) the regret survey bucket against this.
        </p>
        <NumberField
          field="wakeUpHour"
          label="Wake-up hour"
          min={0}
          max={23}
          hint="0 – 23 (local time)"
        />
      </section>

      <section>
        <h2>Breaktime</h2>
        <p>
          After this many minutes of accumulated tracked usage, you'll get an
          alert and a hold-to-continue challenge. (Alerts ship in slice 4.)
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
          Maximum simultaneous tabs whose host is tracked. New tabs over this
          limit are closed automatically. (Enforcement ships in slice 5.)
        </p>
        <NumberField
          field="tabLimit"
          label="Max tracked tabs"
          min={1}
          max={20}
        />
      </section>
    </>
  );
}
