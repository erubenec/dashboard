import Button from "@components/Button";
import FancyToggleSwitch from "@components/FancyToggleSwitch";
import HelpText from "@components/HelpText";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import {
  SelectDropdown,
  SelectOption,
} from "@components/select/SelectDropdown";
import { cn } from "@utils/helpers";
import { ClockIcon, MinusCircleIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ServiceSchedule,
  ServiceScheduleDay,
  ServiceScheduleDays,
} from "@/interfaces/ReverseProxy";
import {
  DAY_LABELS,
  draftToSchedule,
  listTimezones,
  newScheduleDraft,
  newWindow,
  ScheduleDraft,
  scheduleToDraft,
  toggleDay,
  validateDates,
  validateSchedule,
  validateWindow,
  WindowDraft,
} from "@/modules/reverse-proxy/schedule/serviceSchedule";

type Props = {
  value: ServiceSchedule | undefined;
  onChange: (value: ServiceSchedule | undefined) => void;
  onValidationChange?: (hasErrors: boolean) => void;
};

export const ReverseProxySchedule = ({
  value,
  onChange,
  onValidationChange,
}: Props) => {
  const [draft, setDraft] = useState<ScheduleDraft | undefined>(() =>
    value ? scheduleToDraft(value) : undefined,
  );

  const timezoneOptions = useMemo<SelectOption[]>(
    () =>
      listTimezones(draft?.timezone).map((zone) => ({
        label: zone,
        value: zone,
        icon: (props) => <ClockIcon {...props} />,
      })),
    [draft?.timezone],
  );

  // Every edit goes through here so the parent always holds the current
  // schedule and knows whether it can be saved.
  const commit = (next: ScheduleDraft | undefined) => {
    setDraft(next);
    onChange(next ? draftToSchedule(next) : undefined);
    onValidationChange?.(next ? validateSchedule(next) !== "" : false);
  };

  const update = (patch: Partial<ScheduleDraft>) => {
    if (draft) commit({ ...draft, ...patch });
  };

  const updateWindow = (id: string, patch: Partial<WindowDraft>) => {
    if (!draft) return;
    commit({
      ...draft,
      windows: draft.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });
  };

  const removeWindow = (id: string) => {
    if (!draft) return;
    commit({ ...draft, windows: draft.windows.filter((w) => w.id !== id) });
  };

  const addWindow = () => {
    if (draft) commit({ ...draft, windows: [...draft.windows, newWindow()] });
  };

  const dateError = draft ? validateDates(draft.startDate, draft.endDate) : "";

  return (
    <div className={"flex flex-col gap-4"}>
      <FancyToggleSwitch
        value={draft !== undefined}
        onChange={(enabled) => commit(enabled ? newScheduleDraft() : undefined)}
        label={
          <>
            <ClockIcon size={14} />
            Schedule
          </>
        }
        helpText={
          "Make this service reachable only at certain times. Outside the schedule, visitors see a service unavailable page."
        }
        data-testid="toggle-schedule"
      />

      {draft && (
        <div className={"flex flex-col gap-5"} data-testid="schedule-editor">
          <div>
            <Label>Timezone</Label>
            <HelpText>
              Times and dates below are interpreted in this timezone.
            </HelpText>
            <div data-testid="schedule-timezone">
              <SelectDropdown
                value={draft.timezone}
                onChange={(timezone) => update({ timezone })}
                options={timezoneOptions}
                showSearch
                searchPlaceholder={"Search timezone..."}
              />
            </div>
          </div>

          <div>
            <Label>Active hours</Label>
            <HelpText>
              Add one or more time windows. Use 00:00 as the end time for
              midnight. With no windows, the service is active all day.
            </HelpText>
            {draft.windows.length > 0 && (
              <div className={"flex flex-col gap-3 mt-1 mb-3"}>
                {draft.windows.map((window, index) => (
                  <WindowRow
                    key={window.id}
                    index={index}
                    window={window}
                    onChange={(patch) => updateWindow(window.id, patch)}
                    onRemove={() => removeWindow(window.id)}
                  />
                ))}
              </div>
            )}
            <Button
              variant={"dotted"}
              className={"w-full"}
              size={"sm"}
              onClick={addWindow}
              data-testid="add-schedule-window"
            >
              <PlusIcon size={14} />
              Add Time Window
            </Button>
          </div>

          <div>
            <Label>Date range (optional)</Label>
            <HelpText>
              Only serve the service from the start date until the end date,
              both included.
            </HelpText>
            <div className={"flex gap-3"}>
              <Input
                type={"date"}
                aria-label={"Start date"}
                value={draft.startDate}
                max={draft.endDate || undefined}
                onChange={(e) => update({ startDate: e.target.value })}
                data-testid="schedule-start-date"
              />
              <Input
                type={"date"}
                aria-label={"End date"}
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={(e) => update({ endDate: e.target.value })}
                data-testid="schedule-end-date"
              />
            </div>
            {dateError && (
              <p className={"text-xs text-red-500 mt-2"}>{dateError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

type WindowRowProps = {
  index: number;
  window: WindowDraft;
  onChange: (patch: Partial<WindowDraft>) => void;
  onRemove: () => void;
};

const WindowRow = ({ index, window, onChange, onRemove }: WindowRowProps) => {
  const error = validateWindow(window);

  return (
    <div data-testid={`schedule-window-${index}`}>
      <div className={"flex items-center justify-between gap-3"}>
        <div className={"flex gap-1"} role={"group"} aria-label={"Days"}>
          {ServiceScheduleDays.map((day) => (
            <DayToggle
              key={day}
              day={day}
              active={window.days.includes(day)}
              onClick={() => onChange({ days: toggleDay(window.days, day) })}
            />
          ))}
        </div>
        <Button
          variant={"default-outline"}
          className={"h-[42px] w-[42px] !px-0 shrink-0"}
          onClick={onRemove}
          aria-label={"Remove time window"}
          data-testid="remove-schedule-window"
        >
          <MinusCircleIcon size={14} />
        </Button>
      </div>
      <div className={"flex items-center gap-2 mt-2"}>
        <Input
          type={"time"}
          aria-label={"Start time"}
          value={window.start}
          onChange={(e) => onChange({ start: e.target.value })}
          maxWidthClass={"w-[140px]"}
          data-testid="schedule-window-start"
        />
        <span className={"text-nb-gray-400 text-sm"}>to</span>
        <Input
          type={"time"}
          aria-label={"End time"}
          value={window.end}
          onChange={(e) => onChange({ end: e.target.value })}
          maxWidthClass={"w-[140px]"}
          data-testid="schedule-window-end"
        />
      </div>
      {error && (
        <p
          className={"text-xs text-red-500 mt-2"}
          data-testid="schedule-window-error"
        >
          {error}
        </p>
      )}
    </div>
  );
};

type DayToggleProps = {
  day: ServiceScheduleDay;
  active: boolean;
  onClick: () => void;
};

const DayToggle = ({ day, active, onClick }: DayToggleProps) => (
  <button
    type={"button"}
    aria-pressed={active}
    onClick={onClick}
    data-testid={`schedule-day-${day}`}
    className={cn(
      "h-[42px] w-[44px] rounded-md border text-xs font-medium transition-colors",
      active
        ? "bg-netbird/20 border-netbird text-netbird-100"
        : "bg-nb-gray-900 border-nb-gray-700 text-nb-gray-300 hover:bg-nb-gray-800",
    )}
  >
    {DAY_LABELS[day]}
  </button>
);
