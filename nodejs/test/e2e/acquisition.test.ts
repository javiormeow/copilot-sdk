/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { CopilotClient } from "../../src/index.js";
import { acquireCli, PREFERRED_CLI_VERSION } from "../../src/acquisition.js";

describe("CLI Acquisition E2E", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `copilot-acquisition-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it("should download CLI and start client successfully", async () => {
        const progressUpdates: { bytesDownloaded: number; totalBytes: number }[] = [];

        const client = new CopilotClient({
            acquisition: {
                downloadDir: testDir,
                onProgress: (progress) => {
                    progressUpdates.push({ ...progress });
                },
            },
            autoStart: false,
            logLevel: "error",
        });

        try {
            await client.start();

            // Verify client is connected
            expect(client.getState()).toBe("connected");

            // Verify CLI was downloaded
            const entries = readdirSync(testDir);
            expect(entries.some(e => e.startsWith("copilot-"))).toBe(true);

            // Verify progress was reported (at least some bytes downloaded)
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1].bytesDownloaded).toBeGreaterThan(0);

            // Verify ping works
            const pong = await client.ping("test");
            expect(pong.message).toBe("pong: test");
        } finally {
            await client.forceStop();
        }
    }, 120000); // 2 minute timeout for download

    it("should reuse existing compatible CLI without downloading", async () => {
        // First, download the CLI
        const cliPath = await acquireCli({
            downloadDir: testDir,
        });

        expect(existsSync(cliPath)).toBe(true);

        // Now create a client - should reuse without downloading
        let downloadStarted = false;
        const client = new CopilotClient({
            acquisition: {
                downloadDir: testDir,
                onProgress: () => {
                    downloadStarted = true;
                },
            },
            autoStart: false,
            logLevel: "error",
        });

        try {
            await client.start();
            expect(client.getState()).toBe("connected");
            // No download should have occurred
            expect(downloadStarted).toBe(false);
        } finally {
            await client.forceStop();
        }
    }, 120000);

    it("should reject ~/.copilot as downloadDir", async () => {
        const copilotDir = join(homedir(), ".copilot");

        const client = new CopilotClient({
            acquisition: {
                downloadDir: copilotDir,
            },
            autoStart: false,
            logLevel: "error",
        });

        await expect(client.start()).rejects.toThrow("reserved for the global Copilot CLI installation");
    });

    it("should clean up old versions after acquisition", async () => {
        // Create a fake old version directory
        const oldVersionDir = join(testDir, "copilot-0.0.1");
        mkdirSync(oldVersionDir, { recursive: true });

        // Download the current version
        await acquireCli({
            downloadDir: testDir,
        });

        // Old version should be cleaned up
        expect(existsSync(oldVersionDir)).toBe(false);

        // Current version should exist
        const entries = readdirSync(testDir);
        expect(entries.length).toBe(1);
        expect(entries[0]).toBe(`copilot-${PREFERRED_CLI_VERSION}`);
    }, 120000);
});
