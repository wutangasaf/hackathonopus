import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";

import { Chapter } from "@/components/blocks/Chapter";
import { Container } from "@/components/layout/Container";
import { Nav } from "@/components/layout/Nav";
import type { ClassifiedSheet, Discipline } from "@/lib/types";
import { useFinancePlan } from "@/services/financePlan";
import { usePlanClassification, usePlans } from "@/services/plans";
import { useProject } from "@/services/projects";
import { useGanttStore } from "@/stores/ganttStore";

import { ActionBar } from "@/routes/gantt/ActionBar";
import type { ChipData } from "@/routes/gantt/DocChip";
import { Palette } from "@/routes/gantt/Palette";
import { SidePanel } from "@/routes/gantt/SidePanel";
import { Timeline } from "@/routes/gantt/Timeline";

export default function GanttBuilder() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ?? "";

  const project = useProject(projectId);
  const plans = usePlans(projectId);
  const classification = usePlanClassification(projectId);
  const financePlan = useFinancePlan(projectId);

  const hydrateFromPlan = useGanttStore((s) => s.hydrateFromPlan);
  const seedScaffold = useGanttStore((s) => s.seedScaffold);
  const seeded = useGanttStore((s) => s.seeded);
  const addDocRef = useGanttStore((s) => s.addDocRef);

  // One-shot hydration: plan wins if present; otherwise seed an 8-row scaffold.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    if (financePlan.isLoading) return;
    if (financePlan.data) {
      hydrateFromPlan(financePlan.data);
      hydrated.current = true;
    } else if (!seeded) {
      seedScaffold();
      hydrated.current = true;
    }
  }, [
    financePlan.data,
    financePlan.isLoading,
    hydrateFromPlan,
    seedScaffold,
    seeded,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id;
    if (typeof overId !== "string") return;
    if (!overId.startsWith("milestone:")) return;
    const data = e.active.data.current as ChipData | undefined;
    if (!data || data.kind !== "planSheet") return;
    const localId = overId.slice("milestone:".length);
    addDocRef(localId, {
      documentId: data.documentId,
      sheetLabels: data.sheetLabel ? [data.sheetLabel] : undefined,
      notes: `${data.discipline}:p${data.pageNumber}`,
    });
  }

  const knownPlanDocIds = useMemo(
    () => (plans.data ?? []).map((d) => d._id),
    [plans.data],
  );

  const sheets: ClassifiedSheet[] = classification.data?.sheets ?? [];

  const byDiscipline = useMemo(() => {
    const m = new Map<Discipline, number>();
    for (const s of sheets) m.set(s.discipline, (m.get(s.discipline) ?? 0) + 1);
    return m;
  }, [sheets]);

  return (
    <>
      <Nav />
      <Container className="py-12">
        <Chapter
          number="04 · Gantt builder"
          title={
            <>
              Pin docs to
              <br />
              <span className="text-accent">tranches</span>.
            </>
          }
          lead="Each milestone is a tranche: a dated slice of the loan that releases when the bank verifies its required completions. Drag labeled plan pages from the left onto the milestone they govern. Edit dates and amounts in the right panel."
        />

        {classification.isLoading || plans.isLoading ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-muted">
            Loading plan classification…
          </div>
        ) : !classification.data ? (
          <div className="border-l-2 border-danger bg-bg-1 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">
              Error · no plan classification yet
            </div>
            <p className="mt-2 font-mono text-[11px] text-fg-dim">
              Upload plans first, then wait for Agent 1 / 2 to finish. Return
              here from the project&apos;s Plans tab.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {/* Summary strip */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border border-line bg-bg-1 px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-dim">
                {project.data?.name ?? "Project"} ·{" "}
                <span className="text-fg">
                  {sheets.length} pages
                </span>{" "}
                · {byDiscipline.size} disciplines
              </div>
              <div className="flex flex-wrap gap-5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
                {Array.from(byDiscipline.entries()).map(([d, n]) => (
                  <span key={d} className="inline-flex items-center gap-2">
                    <i
                      aria-hidden
                      className={`inline-block h-2 w-2 ${disciplineDot(d)}`}
                    />
                    {d} · {n}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_320px]">
              <Palette sheets={sheets} />
              <Timeline />
              <SidePanel />
            </div>

            <ActionBar
              projectId={projectId}
              planExists={Boolean(financePlan.data)}
              knownPlanDocIds={knownPlanDocIds}
            />
          </DndContext>
        )}
      </Container>
    </>
  );
}

function disciplineDot(d: Discipline): string {
  switch (d) {
    case "ARCHITECTURE":
      return "bg-warn";
    case "STRUCTURAL":
      return "bg-accent";
    case "ELECTRICAL":
      return "bg-success";
    case "PLUMBING":
      return "bg-danger";
  }
}
