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
import {
  DISCIPLINE_LABEL,
  type ClassifiedSheet,
  type Discipline,
} from "@/lib/types";
import { useFinancePlan } from "@/services/financePlan";
import { usePlanClassification, usePlans } from "@/services/plans";
import { useProject } from "@/services/projects";
import { useGanttStore } from "@/stores/ganttStore";

import { ActionBar } from "@/routes/gantt/ActionBar";
import { sheetKey, type ChipData } from "@/routes/gantt/DocChip";
import { Palette } from "@/routes/gantt/Palette";
import { PlanHeader } from "@/routes/gantt/PlanHeader";
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
  const resetAll = useGanttStore((s) => s.resetAll);
  const addDocRef = useGanttStore((s) => s.addDocRef);
  const reorderMilestones = useGanttStore((s) => s.reorderMilestones);
  const milestones = useGanttStore((s) => s.milestones);
  const loanAmount = useGanttStore((s) => s.loanAmount);
  const validate = useGanttStore((s) => s.validate);

  // Rebind the (singleton) store to the current project: reset + hydrate or
  // seed. Keyed on projectId so navigating between projects doesn't leak the
  // previous project's milestones, planDocRefs, or header fields.
  const boundProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (financePlan.isLoading) return;
    if (boundProjectId.current === projectId) return;
    resetAll();
    if (financePlan.data) hydrateFromPlan(financePlan.data);
    else seedScaffold();
    boundProjectId.current = projectId;
  }, [
    projectId,
    financePlan.data,
    financePlan.isLoading,
    hydrateFromPlan,
    seedScaffold,
    resetAll,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const activeId = e.active.id;
    const overId = e.over?.id;
    if (typeof activeId !== "string" || typeof overId !== "string") return;
    const data = e.active.data.current as
      | ChipData
      | { kind: "milestone"; localId: string }
      | undefined;

    // Row reorder: active is a milestone row dragged via its handle.
    if (data?.kind === "milestone") {
      if (activeId === overId) return;
      const toLocal = overId.startsWith("sortable:")
        ? overId.slice("sortable:".length)
        : null;
      if (!toLocal) return;
      const from = milestones.findIndex((m) => m.localId === data.localId);
      const to = milestones.findIndex((m) => m.localId === toLocal);
      if (from >= 0 && to >= 0) reorderMilestones(from, to);
      return;
    }

    // Doc chip → milestone drop. The sortable row is also the droppable
    // target, so `over.id` is `sortable:<localId>`.
    if (data?.kind === "planSheet") {
      const localId = overId.startsWith("sortable:")
        ? overId.slice("sortable:".length)
        : overId.startsWith("milestone:")
        ? overId.slice("milestone:".length)
        : null;
      if (!localId) return;
      addDocRef(localId, {
        documentId: data.documentId,
        sheetLabels: data.sheetLabel ? [data.sheetLabel] : undefined,
        notes: sheetKey({
          documentId: data.documentId,
          pageNumber: data.pageNumber,
        }),
      });
    }
  }

  const knownPlanDocIds = useMemo(
    () => (plans.data ?? []).map((d) => d._id),
    [plans.data],
  );

  // Recompute on every relevant store change so the ActionBar + inline
  // markers always reflect the current draft state.
  const validation = useMemo(
    // validate closes over the store via get(); bust the memo whenever
    // milestones, loanAmount, or known plan docs change.
    () => validate(knownPlanDocIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [milestones, loanAmount, knownPlanDocIds, validate],
  );

  const sheets: ClassifiedSheet[] = classification.data?.sheets ?? [];

  const sheetLookup = useMemo(() => {
    const m = new Map<string, ClassifiedSheet>();
    for (const s of sheets) m.set(sheetKey(s), s);
    return m;
  }, [sheets]);

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
          lead="Starter 8-phase residential template. Rename phases, adjust percentages, or add/remove milestones to match this project. Drag labeled plan pages from the left onto the milestone they govern."
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
            <PlanHeader />

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
                    {DISCIPLINE_LABEL[d]} · {n}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_320px]">
              <Palette sheets={sheets} />
              <Timeline
                sheetLookup={sheetLookup}
                fieldErrors={validation.fieldErrors}
              />
              <SidePanel sheetLookup={sheetLookup} />
            </div>

            <ActionBar
              projectId={projectId}
              planExists={Boolean(financePlan.data)}
              validation={validation}
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
