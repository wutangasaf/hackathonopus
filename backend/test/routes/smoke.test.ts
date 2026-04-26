// Route-level smokes via `fastify.inject()`. Each test mocks the Mongoose
// model statics the handler touches and asserts status + a few keys of the
// response shape. The point is to lock the request lifecycle so a renamed
// route, schema change, or missing plugin shows up in CI before the demo.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/buildApp.js";
import { mongoQuery } from "../helpers/mongoQuery.js";

import { Project } from "../../src/models/project.js";
import { DocumentModel } from "../../src/models/document.js";
import { FinancePlan } from "../../src/models/financePlan.js";
import { Draw } from "../../src/models/draw.js";
import { GapReport } from "../../src/models/gapReport.js";

let app: FastifyInstance;
const PROJECT_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("route smokes", () => {
  it("POST /api/projects creates a project from a JSON body", async () => {
    const created = {
      _id: new Types.ObjectId(),
      name: "Test Project",
      address: "123 Lake St",
      status: "SETUP",
      createdAt: new Date(),
    };
    const createSpy = vi
      .spyOn(Project, "create")
      .mockResolvedValue(created as never);

    const res = await app.inject({
      method: "POST",
      url: "/api/projects/",
      payload: { name: "Test Project", address: "123 Lake St" },
    });

    expect(res.statusCode).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Project", address: "123 Lake St" }),
    );
    const body = res.json();
    expect(body.name).toBe("Test Project");
  });

  it("POST /api/projects rejects an empty name (Zod 400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/",
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/projects/:id/plans returns PLAN documents sorted desc", async () => {
    const docs = [
      { _id: new Types.ObjectId(), kind: "PLAN", originalFilename: "A.pdf" },
      { _id: new Types.ObjectId(), kind: "PLAN", originalFilename: "B.pdf" },
    ];
    const findSpy = vi
      .spyOn(DocumentModel, "find")
      .mockReturnValue(mongoQuery(docs) as never);

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/plans`,
    });

    expect(res.statusCode).toBe(200);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, kind: "PLAN" }),
    );
    const body = res.json();
    expect(body).toHaveLength(2);
  });

  it("GET /api/projects/:id/finance-plan returns the latest plan", async () => {
    const plan = {
      _id: new Types.ObjectId(),
      projectId: PROJECT_ID,
      loanType: "residential",
      loanAmount: 1_000_000,
      milestones: [],
    };
    vi.spyOn(FinancePlan, "findOne").mockReturnValue(
      mongoQuery(plan) as never,
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/finance-plan`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().loanAmount).toBe(1_000_000);
  });

  it("GET /api/projects/:id/finance-plan 404s when no plan exists", async () => {
    vi.spyOn(FinancePlan, "findOne").mockReturnValue(
      mongoQuery(null) as never,
    );
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/finance-plan`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/projects/:id/draws lists draws sorted by drawNumber desc", async () => {
    const draws = [
      { _id: new Types.ObjectId(), drawNumber: 3, status: "approved" },
      { _id: new Types.ObjectId(), drawNumber: 2, status: "approved" },
    ];
    const findSpy = vi
      .spyOn(Draw, "find")
      .mockReturnValue(mongoQuery(draws) as never);

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/draws`,
    });

    expect(res.statusCode).toBe(200);
    expect(findSpy).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].drawNumber).toBe(3);
  });

  it("GET /api/projects/:id/photos lists PHOTO documents", async () => {
    const photos = [
      { _id: new Types.ObjectId(), kind: "PHOTO", originalFilename: "1.jpg" },
    ];
    const findSpy = vi
      .spyOn(DocumentModel, "find")
      .mockReturnValue(mongoQuery(photos) as never);

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/photos`,
    });

    expect(res.statusCode).toBe(200);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, kind: "PHOTO" }),
    );
  });

  it("GET /api/projects/:id/reports lists gap reports", async () => {
    const reports = [
      { _id: new Types.ObjectId(), generatedAt: new Date() },
    ];
    vi.spyOn(GapReport, "find").mockReturnValue(
      mongoQuery(reports) as never,
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${PROJECT_ID}/reports`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("GET on a non-ObjectId :id rejects with 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/not-an-id/plans",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid id/);
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("Zod negative payloads", () => {
  it("PATCH a draw line with approvalStatus='overridden' but no confirmedMilestoneId is rejected (400)", async () => {
    const drawId = new Types.ObjectId().toString();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/projects/${PROJECT_ID}/draws/${drawId}/lines/0`,
      payload: { approvalStatus: "overridden" },
    });
    expect(res.statusCode).toBe(400);
    // Zod flatten() shape: { fieldErrors, formErrors }
    const err = res.json().error;
    const blob = JSON.stringify(err);
    expect(blob).toMatch(/confirmedMilestoneId is required/);
  });

  it("PATCH a milestone with no fields supplied is rejected (400)", async () => {
    const milestoneId = new Types.ObjectId().toString();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/projects/${PROJECT_ID}/finance-plan/milestones/${milestoneId}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const blob = JSON.stringify(res.json().error);
    expect(blob).toMatch(/at least one of/);
  });
});
