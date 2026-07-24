import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { applyCommand, type DocumentCommand } from "@agidn/command-engine";
import type { ViolationCode } from "@agidn/rule-engine";
import { loadFoundationProject } from "../helpers.js";

type InvalidFixture = DocumentCommand & { $expected: ViolationCode };

describe("illegal operation matrix", async () => {
  const directory = resolve("tests/invalid-cases");
  const fixtureNames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();

  it("contains the ten required first-wave counterexamples", () => {
    expect(fixtureNames).toHaveLength(10);
  });

  it.each(fixtureNames)("rejects %s with its stable domain error", async (fixtureName) => {
    const project = await loadFoundationProject();
    const fixture = JSON.parse(await readFile(resolve(directory, fixtureName), "utf8")) as InvalidFixture;
    const { $expected, ...command } = fixture;
    const result = applyCommand(project.document, command as DocumentCommand, project);

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.violations.map(({ code }) => code)).toContain($expected);
    expect(result.document).toEqual(project.document);
    expect(result.violations.every(({ approvalAllowed }) => approvalAllowed === false)).toBe(true);
  });
});
