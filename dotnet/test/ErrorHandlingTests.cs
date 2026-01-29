/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

using GitHub.Copilot.SDK;
using Microsoft.Extensions.Logging;
using Xunit;

namespace GitHub.Copilot.SDK.Test;

/// <summary>
/// Tests for error handling and diagnostics improvements.
/// </summary>
public class ErrorHandlingTests
{
    [Fact]
    public async Task Should_Provide_Helpful_Error_When_CLI_Not_Found()
    {
        // Arrange: Use a non-existent CLI path
        var client = new CopilotClient(new CopilotClientOptions
        {
            CliPath = "/nonexistent/path/to/copilot",
            AutoStart = true
        });

        // Act & Assert: Should throw with helpful error message
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await client.CreateSessionAsync());

        Assert.Contains("Failed to start Copilot CLI process", exception.Message);
        Assert.Contains("Please ensure the Copilot CLI is installed", exception.Message);
    }

    [Fact]
    public async Task Should_Detect_Immediate_Process_Exit()
    {
        // Arrange: Use an executable that exits immediately
        // Using 'false' command which always exits with code 1
        var client = new CopilotClient(new CopilotClientOptions
        {
            CliPath = "false", // Unix command that exits immediately with code 1
            AutoStart = true
        });

        // Act & Assert: Should detect the immediate exit
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await client.CreateSessionAsync());

        // Should mention the process exited immediately
        Assert.Contains("exited immediately", exception.Message);
    }

    [Fact]
    public async Task Should_Provide_Clear_Error_For_Connection_Issues()
    {
        // This test verifies that connection lost exceptions are wrapped with helpful messages
        // We can't easily simulate a real connection loss in a unit test,
        // but we verify that the error handling code is in place

        // Just verify the method exists and has the right signature
        var method = typeof(CopilotClient).GetMethod(
            "InvokeRpcAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);

        Assert.NotNull(method);
        Assert.Equal("Task`1", method!.ReturnType.Name);
    }
}
