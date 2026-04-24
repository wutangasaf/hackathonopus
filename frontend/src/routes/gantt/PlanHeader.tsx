import { useGanttStore } from "@/stores/ganttStore";

export function PlanHeader() {
  const loanAmount = useGanttStore((s) => s.loanAmount);
  const totalBudget = useGanttStore((s) => s.totalBudget);
  const kickoffDate = useGanttStore((s) => s.kickoffDate);
  const requiredCompletionDate = useGanttStore(
    (s) => s.requiredCompletionDate,
  );
  const setField = useGanttStore((s) => s.setField);

  const equityGap = totalBudget - loanAmount;

  return (
    <div className="mb-6 grid grid-cols-2 gap-px border border-line-strong bg-line-strong lg:grid-cols-4">
      <Field label="Loan amount">
        <CurrencyInput
          value={loanAmount}
          onCommit={(v) => setField("loanAmount", v)}
        />
        <Hint>Bank finances · drives tranches</Hint>
      </Field>

      <Field label="Total budget">
        <CurrencyInput
          value={totalBudget}
          onCommit={(v) => setField("totalBudget", v)}
        />
        <Hint>
          {equityGap === 0
            ? "100% bank-financed"
            : equityGap > 0
            ? `Owner equity · $${equityGap.toLocaleString()}`
            : `Loan exceeds budget · $${Math.abs(equityGap).toLocaleString()}`}
        </Hint>
      </Field>

      <Field label="Kickoff">
        <DateInput
          value={kickoffDate}
          onCommit={(iso) => setField("kickoffDate", iso)}
        />
        <Hint>Timeline anchor</Hint>
      </Field>

      <Field label="Required completion">
        <DateInput
          value={requiredCompletionDate}
          onCommit={(iso) => setField("requiredCompletionDate", iso)}
        />
        <Hint>Drop-dead date</Hint>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 bg-bg-1 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
      {children}
    </span>
  );
}

function CurrencyInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[12px] text-fg-muted">$</span>
      <input
        type="text"
        inputMode="numeric"
        defaultValue={value.toLocaleString()}
        key={value}
        onBlur={(e) => {
          const parsed = Number(e.target.value.replace(/[,\s$]/g, ""));
          if (Number.isFinite(parsed) && parsed >= 0) onCommit(Math.round(parsed));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full border-0 bg-transparent p-0 font-mono text-[20px] font-extrabold tracking-tight text-fg focus:outline-none focus:ring-0 focus:[box-shadow:inset_0_-1px_0_var(--accent)]"
      />
    </div>
  );
}

function DateInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (iso: string) => void;
}) {
  return (
    <input
      type="date"
      value={value.slice(0, 10)}
      onChange={(e) => {
        if (!e.target.value) return;
        onCommit(new Date(e.target.value + "T00:00:00Z").toISOString());
      }}
      className="w-full border-0 bg-transparent p-0 font-mono text-[18px] font-bold tracking-tight text-fg focus:outline-none focus:[box-shadow:inset_0_-1px_0_var(--accent)]"
    />
  );
}
