import { motion, type Variants } from "framer-motion";
import { Link } from "react-router-dom";

import { BlockGrid } from "@/components/blocks/BlockGrid";
import { Chapter } from "@/components/blocks/Chapter";
import { Chip } from "@/components/blocks/Chip";
import { DrawVerdictCard } from "@/components/blocks/DrawVerdictCard";
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
  chipTone?: Parameters<typeof Chip>[0]["tone"];
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
    chipTone: "accent",
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
      <section className="relative overflow-hidden border-b border-line-strong pt-14 pb-24 lg:pt-[56px] lg:pb-[96px]">
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: "-120px",
            left: "-10%",
            width: "70%",
            height: "540px",
            background:
              "radial-gradient(ellipse at center, rgba(255,107,26,0.07), transparent 60%)",
          }}
        />
        <Container>
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16"
          >
            <motion.div variants={fadeUp}>
              <Eyebrow>Built with Opus 4.7 · Hackathon preview · Apr 2026</Eyebrow>
              <h1 className="mt-6 break-words font-black leading-[0.88] tracking-[-0.055em] text-fg text-[clamp(44px,9.4vw,148px)]">
                Build
                <br />
                to <span className="text-accent">plan</span>.
                <br />
                Release
                <br />
                on <span className="text-accent">proof</span>.
              </h1>
              <p className="mt-5 max-w-[560px] text-fg-dim text-[clamp(15px,1.35vw,19px)] leading-[1.55]">
                AI co-pilot for bank-financed construction. Plumbline ingests
                the full plan set — drawings at scale, BoQ, specifications,
                RFIs, COs — binds it to an AIA G702/G703 schedule of values,
                and reconciles both against authenticated jobsite evidence.
                The draw verdict cites every SOV line, in minutes.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-l-2 border-accent pl-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim">
                  Capture channels
                </span>
                <span className="inline-flex items-center gap-[6px] font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
                  <i
                    aria-hidden
                    className="inline-block h-[6px] w-[6px] bg-accent"
                    style={{ boxShadow: "0 0 8px var(--accent-glow)" }}
                  />
                  Phone · live
                </span>
                <span className="inline-flex items-center gap-[6px] font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                  <i aria-hidden className="inline-block h-[6px] w-[6px] border border-fg-muted" />
                  Drone · next
                </span>
                <span className="inline-flex items-center gap-[6px] font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                  <i aria-hidden className="inline-block h-[6px] w-[6px] border border-fg-muted" />
                  IoT telemetry · next
                </span>
              </div>
              <p className="mt-3 max-w-[560px] font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                Hash-chained capture · Device attestation · Geo &amp; time-signed
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-all hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.18)]"
                >
                  Bank · start a project <span aria-hidden>↗</span>
                </Link>
                <Link
                  to="/contractor"
                  className="inline-flex items-center gap-2.5 border border-line-strong px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-all hover:border-fg-dim hover:bg-bg-1"
                >
                  Contractor · submit a draw <span aria-hidden>↗</span>
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2.5 px-2 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim transition-colors hover:text-fg"
                >
                  See the pipeline
                </a>
              </div>
              <dl className="mt-10 flex max-w-[560px] flex-wrap gap-8 border-t border-line pt-5">
                <HeroStat value="7" label="Narrow agents, end-to-end" />
                <HeroStat value="4" label="Disciplines reconciled" />
                <HeroStat value="<60s" label="Draw verdict latency" />
              </dl>
            </motion.div>
            <motion.div variants={fadeUp}>
              <DrawVerdictCard />
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* INPUTS */}
      <RevealSection id="inputs">
        <Container>
          <Chapter
            number="01 · Inputs"
            title={
              <>
                Three inputs.
                <br />
                One <span className="text-accent">verdict</span>.
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
                  className="flex min-h-[320px] flex-col justify-between bg-bg p-9 transition-colors hover:bg-[#0c0c0c]"
                >
                  <header className="flex items-start justify-between">
                    <span className="font-mono text-[11px] tracking-wider text-fg-muted">
                      {input.num}
                    </span>
                    <Chip tone={input.chipTone}>{input.chip}</Chip>
                  </header>
                  <div>
                    <h3 className="mt-9 text-[30px] font-extrabold leading-tight tracking-[-0.022em]">
                      {input.title}
                    </h3>
                    <p className="mt-3.5 text-sm leading-relaxed text-fg-dim">
                      {input.body}
                    </p>
                  </div>
                  <div className="mt-7 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
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
          <Chapter
            number="02 · Pipeline"
            title={
              <>
                Seven narrow
                <br />
                <span className="text-accent">agents</span>.
              </>
            }
            lead="Each agent does one thing well, with strict tool-use schemas and full token accounting. Four call Opus 4.7 vision; two are text-only. The orchestration is deterministic; the reasoning is not."
          />

          {/* Pipeline rail with nodes */}
          <div className="relative mb-0 hidden h-7 grid-cols-7 lg:grid" aria-hidden>
            <div
              className="absolute left-[14px] right-[14px] top-[13px] h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, var(--accent) 5%, var(--accent) 95%, transparent)",
              }}
            />
            {AGENTS.map((_, i) => (
              <div key={i} className="relative flex items-center justify-center">
                <span
                  className="z-10 h-[9px] w-[9px] border-2 border-accent"
                  style={{
                    background:
                      i === 0 || i === AGENTS.length - 1
                        ? "var(--accent)"
                        : "var(--bg)",
                  }}
                />
              </div>
            ))}
          </div>

          <motion.div variants={stagger}>
            <BlockGrid className="grid-cols-2 lg:grid-cols-7">
              {AGENTS.map((agent) => (
                <motion.article
                  key={agent.num}
                  variants={fadeUp}
                  className="flex min-h-[200px] flex-col justify-between bg-bg p-5 transition-colors hover:bg-bg-1"
                >
                  <div>
                    <div className="font-mono text-[11px] tracking-wider text-accent">
                      {agent.num}
                    </div>
                    <h4 className="mt-4 text-sm font-bold leading-[1.25] tracking-[-0.01em]">
                      {agent.title}
                    </h4>
                    <p className="mt-3 text-xs leading-[1.5] text-fg-muted">
                      {agent.body}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-[6px] border-t border-line pt-4 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block h-[6px] w-[6px]",
                        agent.kind === "vision" ? "bg-warn" : "bg-accent",
                      )}
                    />
                    {agent.kind === "vision" ? "Vision" : "Text"}
                  </div>
                </motion.article>
              ))}
            </BlockGrid>
          </motion.div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
            <div className="flex flex-wrap gap-5">
              <span className="inline-flex items-center gap-2">
                <i aria-hidden className="inline-block h-2 w-2 bg-warn" />
                Vision
              </span>
              <span className="inline-flex items-center gap-2">
                <i aria-hidden className="inline-block h-2 w-2 bg-accent" />
                Text
              </span>
            </div>
            <div>
              Deterministic orchestration · Full token accounting · Strict
              tool schemas
            </div>
          </div>
        </Container>
      </RevealSection>

      {/* GAP REPORT */}
      <RevealSection id="report">
        <Container>
          <Chapter
            number="03 · The screen bankers want"
            title={
              <>
                Verified. Cited.
                <br />
                <span className="text-accent">Signable</span>.
              </>
            }
            lead="The Gap Report is the one artifact the CRMC signs and the bank funds against. Every cell cites photos. Every deviation carries a flag. Every verdict is traceable to the evidence that produced it."
          />
          <motion.div variants={fadeUp}>
            <div className="border border-line-strong bg-bg-1 p-10">
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
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                    Draw verdict
                  </span>
                  <span className="border border-success/30 bg-success/10 px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-success">
                    Approve with conditions
                  </span>
                  <span className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.035em]">
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

                  <div className="mt-8 border-l-2 border-accent bg-bg px-6 py-5">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
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

      {/* CLOSING CTA */}
      <section
        id="start"
        className="relative overflow-hidden border-b border-line py-[120px] pb-20 text-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-120px] h-[360px] w-3/5 -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,107,26,0.07), transparent 65%)",
          }}
        />
        <Container className="relative">
          <div className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-dim">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 bg-accent"
              style={{ boxShadow: "0 0 8px rgba(255,107,26,0.5)" }}
            />
            Start a project
          </div>
          <h2 className="mt-4 text-[clamp(48px,7.5vw,120px)] font-black leading-[0.92] tracking-[-0.05em]">
            Build to <span className="text-accent">plan</span>.
            <br />
            Release on <span className="text-accent">proof</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-[540px] text-base leading-relaxed text-fg-dim">
            Plug in the loan&apos;s plans and finance plan once. Send phone
            photos as the build progresses. Get a signable draw verdict every
            milestone — in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2.5 bg-accent px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition-all hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.18)]"
            >
              Bank · start a project <span aria-hidden>↗</span>
            </Link>
            <Link
              to="/contractor"
              className="inline-flex items-center gap-2.5 border border-line-strong px-6 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg transition-all hover:border-fg-dim hover:bg-bg-1"
            >
              Contractor · submit a draw <span aria-hidden>↗</span>
            </Link>
            <a
              href="mailto:asafe79@gmail.com"
              className="inline-flex items-center gap-2.5 px-3 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim transition-colors hover:text-fg"
            >
              Talk to founders
            </a>
          </div>
        </Container>
      </section>

      <Footer />
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-mono text-[26px] font-semibold tracking-[-0.02em] leading-none">
        {value}
      </dt>
      <dd className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
        {label}
      </dd>
    </div>
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
      className="border-b border-line-strong py-[96px]"
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
          className="inline-flex items-center gap-[6px] font-mono text-[10px] uppercase tracking-wider text-fg-dim"
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
