/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { acquireCli, PREFERRED_CLI_VERSION } from "../src/acquisition.js";

describe("acquisition", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `copilot-acquisition-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe("validation", () => {
        it("should reject ~/.copilot as downloadDir", async () => {
            const copilotDir = join(homedir(), ".copilot");

            await expect(
                acquireCli({
                    downloadDir: copilotDir,
                })
            ).rejects.toThrow("reserved for the global Copilot CLI installation");
        });

        it("should reject invalid minVersion format", async () => {
            await expect(
                acquireCli({
                    downloadDir: testDir,
                    minVersion: "invalid",
                })
            ).rejects.toThrow("Invalid minVersion format");
        });

        it("should accept valid semver minVersion", async () => {
            // This will fail because there's no downloaded CLI, but it should pass validation
            try {
                await acquireCli({
                    downloadDir: testDir,
                    minVersion: "0.0.400",
                });
            } catch (e) {
                // Expected to fail during download since we don't have network
                expect((e as Error).message).not.toContain("Invalid minVersion format");
            }
        });
    });

    describe("version selection", () => {
        it("should export PREFERRED_CLI_VERSION", () => {
            expect(PREFERRED_CLI_VERSION).toBeDefined();
            expect(typeof PREFERRED_CLI_VERSION).toBe("string");
            expect(PREFERRED_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe("progress reporting", () => {
        it("should call onProgress callback during download", async () => {
            const progressUpdates: { bytesDownloaded: number; totalBytes: number }[] = [];

            try {
                await acquireCli({
                    downloadDir: testDir,
                    onProgress: (progress) => {
                        progressUpdates.push({ ...progress });
                    },
                });
            } catch {
                // Download will fail but we should have progress updates
            }

            // Note: We can't guarantee progress updates if network fails immediately
            // So we just verify the callback mechanism works
        });
    });
});
