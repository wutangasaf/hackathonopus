import { cn } from "@/lib/utils";

export type CaptureDevice = "phone" | "drone" | "iot";

const DEVICES: {
  id: CaptureDevice;
  label: string;
  sub: string;
  status: "active" | "preview";
  hint: string;
}[] = [
  {
    id: "phone",
    label: "Phone",
    sub: "Camera · GPS · timestamp",
    status: "active",
    hint: "Live now · EXIF verified on native shots",
  },
  {
    id: "drone",
    label: "Drone",
    sub: "Aerial sweep · orthomosaic",
    status: "preview",
    hint: "Q3 · DJI / Skydio SDK",
  },
  {
    id: "iot",
    label: "IoT sensor",
    sub: "Jobsite camera · auto-trigger",
    status: "preview",
    hint: "Q3 · RTSP + webhook",
  },
];

export function DeviceChooser({
  selected,
  onSelect,
}: {
  selected: CaptureDevice;
  onSelect: (d: CaptureDevice) => void;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-muted">
        Capture device
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {DEVICES.map((d) => {
          const active = d.id === selected;
          const disabled = d.status !== "active";
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(d.id)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start gap-2 border px-4 py-4 text-left transition-colors",
                active
                  ? "border-accent bg-bg-1"
                  : disabled
                    ? "cursor-not-allowed border-dashed border-line bg-bg-1 opacity-60"
                    : "border-line-strong bg-bg hover:bg-bg-1",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fg">
                  {d.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-[0.14em]",
                    d.status === "active" ? "text-accent" : "text-fg-muted",
                  )}
                >
                  {d.status === "active" ? "Live" : "Coming"}
                </span>
              </div>
              <div className="text-[13px] leading-[1.35] text-fg">{d.sub}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                {d.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
