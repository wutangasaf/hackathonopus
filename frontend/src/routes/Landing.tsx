import { motion, type Variants } from "framer-motion";
import { Link } from "react-router-dom";

import { BlockGrid } from "@/components/blocks/BlockGrid";
import { BrickWall } from "@/components/blocks/BrickWall";
import { Chip } from "@/components/blocks/Chip";
import { Eyebrow } from "@/components/blocks/Eyebrow";
import { Container } from "@/components/layout/Container";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { cn } from "@/lib/utils";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

type Input = {
  num: string;
  chip: string;
  title: string;
  body: string;
  cadence: string;
};

const INPUTS: Input[] = [
  {
    num: "01",
    chip: "PDF · slow",
    title: "Construction plans",
    body: "Architectural, structural, electrical, plumbing drawings. Agent 1 classifies pages; Agent 2 extracts a discipline-shaped format that photos can later match.",
    cadence: "Once at loan origination · Versioned on CO",
  },
  {
    num: "02",
    chip: "G703 · slow",
    title: "Finance plan",
    body: "Schedule of Values with milestones tied to required completion per discipline. Agent 3 parses line items + draws. Each milestone gates a dollar release.",
    cadence: "Once at loan origination · Amended on CO",
  },
  {
    num: "03",
    chip: "IMG · live",
    title: "Jobsite imagery",
    body: "Phone photos from the builder, arriving monthly or continuously. Agent 5 gates quality; Agent 6 converts each photo into the plan's format for diffing.",
    cadence: "Monthly per draw · Continuous between",
  },
];

type Agent = {
  num: string;
  title: string;
  body: string;
  kind: "vision" | "text";
};

const AGENTS: Agent[] = [
  {
    num: "01",
    title: "Plan Classifier",
    body: "Per-page discipline, sheet role, titleblock metadata.",
    kind: "vision",
  },
  {
    num: "02",
    title: "Plan Format",
    body: "Per-discipline elements and inspector checklist.",
    kind: "vision",
  },
  {
    num: "03",
    title: "Finance Plan",
    body: "SOV line items, milestones, draw requirements.",
    kind: "vision",
  },
  {
    num: "04",
    title: "Photo Guidance",
    body: "Shot list keyed to the active milestone.",
    kind: "text",
  },
  {
    num: "05",
    title: "Photo Quality",
    body: "Gate: is this photo good enough, on-phase?",
    kind: "vision",
  },
  {
    num: "06",
    title: "Photo → Format",
    body: "Convert the photo into the plan's format for diff.",
    kind: "vision",
  },
  {
    num: "07",
    title: "Gap & Verdict",
    body: "G703 rollup, deviations, APPROVE / DISPUTE.",
    kind: "text",
  },
];

type CellTone = "ok" | "partial" | "dev" | "miss" | "na";

type MatrixRow = {
  label: string;
  cells: { tone: CellTone; value?: string }[];
};

const MATRIX_COLS = [
  "Foundation",
  "Framing",
  "Envelope",
  "Roofing",
  "MEP rough",
  "Insulation",
];

const MATRIX: MatrixRow[] = [
  {
    label: "Architecture",
    cells: [
      { tone: "ok", value: "100" },
      { tone: "ok", value: "100" },
      { tone: "partial", value: "78" },
      { tone: "ok", value: "100" },
      { tone: "na" },
      { tone: "partial", value: "45" },
    ],
  },
  {
    label: "Structural",
    cells: [
      { tone: "ok", value: "100" },
      { tone: "ok", value: "100" },
      { tone: "ok", value: "95" },
      { tone: "ok", value: "100" },
      { tone: "na" },
      { tone: "na" },
    ],
  },
  {
    label: "Electrical",
    cells: [
      { tone: "na" },
      { tone: "na" },
      { tone: "na" },
      { tone: "na" },
      { tone: "dev", value: "62" },
      { tone: "miss", value: "—" },
    ],
  },
  {
    label: "Plumbing",
    cells: [
      { tone: "ok", value: "100" },
      { tone: "na" },
      { tone: "na" },
      { tone: "na" },
      { tone: "partial", value: "54" },
      { tone: "miss", value: "—" },
    ],
  },
];

const CELL_TONE_CLASS: Record<CellTone, string> = {
  ok: "bg-success/85 text-[#003d24]",
  partial: "bg-warn/80 text-[#3d2d00]",
  dev: "bg-danger/85 text-[#3d0000]",
  miss: "bg-transparent text-fg-muted border border-dashed border-fg-muted",
  na: "bg-bg-1 opacity-30",
};

type Deviation = {
  tag: string;
  title: string;
  body: string;
  cite: string;
};

const DEVIATIONS: Deviation[] = [
  {
    tag: "Unapproved CO",
    title: "Electrical service upgraded to 400A.",
    body: "Plan spec: 200A service drop (sheet E-101). Observed panel is 400A with sub-panels. No approved change order on file.",
    cite: "P-0472 · E-101",
  },
  {
    tag: "Deviation",
    title: "Partition wall, L1 west, offset ~3 ft from plan.",
    body: "Framed wall location does not match A-201 layout. Impacts downstream MEP routing. Refer for CRMC review.",
    cite: "P-0481 · A-201",
  },
];

export default function Landing() {
  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line pt-[120px] pb-[160px]">
        <Container>
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="grid grid-cols-1 items-end gap-16 lg:grid-cols-[1.35fr_1fr]"
          >
            <motion.div variants={fadeUp}>
              <Eyebrow>Built with Opus 4.7 · Apr 2026</Eyebrow>
              <h1 className="mt-10 font-black leading-[0.86] tracking-display text-fg text-[clamp(56px,10.5vw,168px)]">
                Build
                <br />
                to <span className="text-brand">plan</span>.
                <br />
                Release
                <br />
                on <span className="text-brand">proof</span>.
              </h1>
              <p className="mt-7 max-w-[540px] text-fg-dim text-[clamp(16px,1.5vw,20px)] leading-[1.45]">
                AI co-pilot for bank-financed construction. Upload approved
                plans, the finance plan with milestones, and phone photos.
                Plumbline produces the draw verdict — citing G703 line items,
                flagging unapproved deviations — in minutes, not weeks.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-[10px] border border-transparent bg-brand px-[26px] py-[14px] font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-black transition-all hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.15)]"
                >
                  Start a project <span aria-hidden>↗</span>
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-[10px] border border-line-strong px-[26px] py-[14px] font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg transition-all hover:border-fg-dim hover:bg-bg-1"
                >
                  See the pipeline
                </a>
              </div>
              <dl className="mt-14 flex flex-wrap gap-12 border-t border-line pt-6">
                <HeroStat value="7" label="Agents, end-to-end" />
                <HeroStat value="4" label="Disciplines read" />
                <HeroStat value="<60s" label="Report latency" />
              </dl>
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="hidden justify-self-end lg:block"
            >
              <BrickWall />
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* INPUTS */}
      <RevealSection id="inputs">
        <Container>
          <SectionHead
            eyebrow="01 · Inputs"
            heading={
              <>
                Three inputs.
                <br />
                One verdict.
              </>
            }
            lead="Every Plumbline verdict is the composition of three things — the plans the bank pinned to the loan, the finance plan that prices them, and the imagery that proves them. Each arrives on its own cadence."
          />
          <motion.div variants={stagger}>
            <BlockGrid className="grid-cols-1 lg:grid-cols-3">
              {INPUTS.map((input) => (
                <motion.article
                  key={input.num}
                  variants={fadeUp}
                  className="flex min-h-[320px] flex-col justify-between bg-bg px-8 py-10 transition-colors hover:bg-bg-1"
                >
                  <header className="flex items-start justify-between">
                    <span className="font-mono text-[11px] tracking-mono text-fg-muted">
                      {input.num}
                    </span>
                    <Chip>{input.chip}</Chip>
                  </header>
                  <div>
                    <h3 className="mt-12 text-[32px] font-extrabold leading-[1.05] tracking-tight2">
                      {input.title}
                    </h3>
                    <p className="mt-4 text-sm leading-[1.55] text-fg-dim">
                      {input.body}
                    </p>
                  </div>
                  <div className="mt-8 font-mono text-[10px] uppercase tracking-eyebrow text-fg-muted">
                    {input.cadence}
                  </div>
                </motion.article>
              ))}
            </BlockGrid>
          </motion.div>
        </Container>
      </RevealSection>

      {/* PIPELINE */}
      <RevealSection id="pipeline">
        <Container>
          <SectionHead
            eyebrow="02 · Pipeline"
            heading={
              <>
                Seven narrow
                <br />
                agents.
              </>
            }
            lead="Each agent does one thing well, with strict tool-use schemas and full token accounting. Four call Opus 4.7 vision; two are text-only. The orchestration is deterministic; the reasoning is not."
          />
          <motion.div variants={stagger}>
            <BlockGrid className="grid-cols-2 lg:grid-cols-7">
              {AGENTS.map((agent) => (
                <motion.article
                  key={agent.num}
                  variants={fadeUp}
                  className="flex min-h-[200px] flex-col justify-between bg-bg px-5 py-7 transition-colors hover:bg-bg-1"
                >
                  <div>
                    <div className="font-mono text-[11px] tracking-mono text-brand">
                      {agent.num}
                    </div>
                    <h4 className="mt-[18px] text-sm font-bold leading-[1.25] tracking-[-0.01em]">
                      {agent.title}
                    </h4>
                    <p className="mt-3 text-xs leading-[1.5] text-fg-muted">
                      {agent.body}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-[6px] border-t border-line pt-4 font-mono text-[10px] uppercase tracking-mono text-fg-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block h-[6px] w-[6px]",
                        agent.kind === "vision" ? "bg-warn" : "bg-brand",
                      )}
                    />
                    {agent.kind === "vision" ? "Vision" : "Text"}
                  </div>
                </motion.article>
              ))}
            </BlockGrid>
          </motion.div>
        </Container>
      </RevealSection>

      {/* GAP REPORT */}
      <RevealSection id="report">
        <Container>
          <SectionHead
            eyebrow="03 · The screen bankers want"
            heading={
              <>
                Verified. Cited.
                <br />
                Signable.
              </>
            }
            lead="The Gap Report is the one artifact the CRMC signs and the bank funds against. Every cell cites photos. Every deviation carries a flag. Every verdict is traceable to the evidence that produced it."
          />
          <motion.div variants={fadeUp}>
            <div className="border border-line bg-bg-1 p-10">
              <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-7">
                <div>
                  <h3 className="text-[22px] font-bold tracking-[-0.015em]">
                    Potwine Passive House · Milestone 3 — Dry-in
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-6 font-mono text-[11px] tracking-[0.08em] text-fg-dim">
                    <span>
                      Report{" "}
                      <b className="font-medium text-fg">GR-0042</b>
                    </span>
                    <span>
                      As of{" "}
                      <b className="font-medium text-fg">2026-07-15</b>
                    </span>
                    <span>
                      Photos <b className="font-medium text-fg">13</b>
                    </span>
                    <span>
                      Plan rev <b className="font-medium text-fg">v3</b>
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[280px] flex-col items-end gap-[6px]">
                  <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-dim">
                    Draw verdict
                  </span>
                  <span className="border border-success/35 bg-success/10 px-[14px] py-[6px] font-mono text-[12px] uppercase tracking-eyebrow text-success">
                    Approve with conditions
                  </span>
                  <span className="mt-1 text-[44px] font-extrabold tracking-[-0.03em]">
                    $2,000,000
                  </span>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <div className="mb-4 flex items-baseline justify-between gap-4">
                    <h4 className="text-[13px] font-semibold tracking-[0.02em]">
                      Progress matrix · discipline × trade
                    </h4>
                    <Legend />
                  </div>
                  <div
                    className="grid gap-[2px] bg-[var(--line)] p-[1px]"
                    style={{
                      gridTemplateColumns: "90px repeat(6, minmax(0,1fr))",
                    }}
                  >
                    <div className="bg-bg-1" />
                    {MATRIX_COLS.map((col) => (
                      <div
                        key={col}
                        className="bg-bg-1 px-[6px] py-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-fg-muted"
                      >
                        {col}
                      </div>
                    ))}
                    {MATRIX.map((row) => (
                      <MatrixRowCells key={row.label} row={row} />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 text-[13px] font-semibold tracking-[0.02em]">
                    Flagged deviations ({DEVIATIONS.length})
                  </h4>
                  <div className="flex flex-col gap-[2px] bg-[var(--line)]">
                    {DEVIATIONS.map((d) => (
                      <div
                        key={d.title}
                        className="grid grid-cols-[auto_1fr_auto] items-start gap-3 bg-bg px-4 py-[14px]"
                      >
                        <span className="whitespace-nowrap border border-danger/40 bg-danger/15 px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.12em] text-danger">
                          {d.tag}
                        </span>
                        <div>
                          <div className="text-[13px] font-medium leading-[1.4]">
                            {d.title}
                          </div>
                          <div className="mt-1 text-xs leading-[1.5] text-fg-muted">
                            {d.body}
                          </div>
                        </div>
                        <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.06em] text-fg-dim">
                          {d.cite}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 border-l-2 border-brand bg-bg px-6 py-5">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-mono text-fg-dim">
                      Narrative · CRMC draft
                    </div>
                    <p className="text-sm leading-[1.6] text-fg">
                      Milestone 3 (Dry-in) is substantially complete against
                      the plan with two flagged deviations. Envelope finishes
                      trail by ~22% against the approved schedule but are
                      within the 30-day cure window. The 400A electrical
                      upgrade requires formal change-order documentation
                      before the next draw. Recommending{" "}
                      <b>approve with conditions</b>, release $2.0M less 10%
                      retainage, contingent on CO filing within 10 business
                      days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </Container>
      </RevealSection>

      <Footer />
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-mono text-[28px] font-semibold tracking-[-0.02em]">
        {value}
      </dt>
      <dd className="mt-1 font-mono text-[11px] uppercase tracking-mono text-fg-muted">
        {label}
      </dd>
    </div>
  );
}

function SectionHead({
  eyebrow,
  heading,
  lead,
}: {
  eyebrow: string;
  heading: React.ReactNode;
  lead: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="mb-16 grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_2fr]"
    >
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-6 text-[clamp(32px,4.5vw,64px)] font-extrabold leading-none tracking-[-0.035em]">
          {heading}
        </h2>
      </div>
      <p className="text-[17px] leading-[1.55] text-fg-dim">{lead}</p>
    </motion.div>
  );
}

function RevealSection({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
      variants={stagger}
      className="border-b border-line py-[120px]"
    >
      {children}
    </motion.section>
  );
}

function Legend() {
  const items: { tone: Exclude<CellTone, "na">; label: string }[] = [
    { tone: "ok", label: "Verified" },
    { tone: "partial", label: "Partial" },
    { tone: "dev", label: "Deviated" },
    { tone: "miss", label: "Missing" },
  ];
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((it) => (
        <span
          key={it.tone}
          className="inline-flex items-center gap-[6px] font-mono text-[10px] uppercase tracking-mono text-fg-dim"
        >
          <span aria-hidden className={cn("h-[10px] w-[10px]", legendDot(it.tone))} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function legendDot(tone: Exclude<CellTone, "na">): string {
  switch (tone) {
    case "ok":
      return "bg-success";
    case "partial":
      return "bg-warn";
    case "dev":
      return "bg-danger";
    case "miss":
      return "border border-fg-muted bg-[repeating-linear-gradient(45deg,var(--fg-muted)_0_2px,transparent_2px_5px)]";
  }
}

function MatrixRowCells({ row }: { row: MatrixRow }) {
  return (
    <>
      <div className="flex items-center justify-end bg-bg-1 px-[14px] py-2 font-mono text-[9px] uppercase tracking-[0.08em] text-fg-muted">
        {row.label}
      </div>
      {row.cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            "flex aspect-square cursor-pointer items-center justify-center font-mono text-[10px] font-semibold transition-transform hover:z-10 hover:scale-[1.08]",
            c.tone !== "miss" && "bg-bg-2 text-fg",
            CELL_TONE_CLASS[c.tone],
          )}
        >
          {c.value}
        </div>
      ))}
    </>
  );
}
