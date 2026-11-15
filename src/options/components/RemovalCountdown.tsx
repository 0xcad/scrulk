import { formatRemovalCountdown } from "../../shared/delayedRemovals";

interface Props {
  deadline: number;
  now: number;
  itemLabel: string;
}

export function RemovalCountdown({ deadline, now, itemLabel }: Props) {
  const time = formatRemovalCountdown(deadline, now);
  return (
    <small
      class="removal-countdown"
      title={`${itemLabel} will be removed in ${time}`}
    >
      <span aria-hidden="true">🕒</span> {time}
    </small>
  );
}
