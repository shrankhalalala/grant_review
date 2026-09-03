import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("health endpoint", () => {
  it("returns a successful JSON health response", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns a JSON 404 response for unknown routes", async () => {
    const response = await request(app).get("/unknown-route");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({
      status: 404,
      message: "Route not found.",
    });
  });
});
