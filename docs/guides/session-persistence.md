# Session Resume & Persistence

This guide walks you through the SDK's session persistence capabilities—how to pause work, resume it later, and manage sessions in production environments.

## How Sessions Work

When you create a session, the Copilot CLI maintains conversation history, tool state, and planning context. By default, this state lives in memory and disappears when the session ends. With persistence enabled, you can resume sessions across restarts, container migrations, or even different client instances.

```mermaid
flowchart LR
    subgraph Lifecycle["Session Lifecycle"]
        A[Create Session] --> B[Active]
        B --> C[Paused]
        C --> D[Resume]
        D --> B
    end
    
    A --> |"session_id assigned"| A1[" "]
    B --> |"prompts, tool calls"| B1[" "]
    C --> |"state saved to disk"| C1[" "]
    D --> |"state loaded from disk"| D1[" "]
    
    style A1 fill:none,stroke:none
    style B1 fill:none,stroke:none
    style C1 fill:none,stroke:none
    style D1 fill:none,stroke:none
```

## Quick Start: Creating a Resumable Session

The key to resumable sessions is providing your own `session_id`. Without one, the SDK generates a random ID and the session can't be resumed later.

### TypeScript

```typescript
import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();

// Create a session with a meaningful ID
const session = await client.createSession({
  sessionId: "user-123-task-456",
  model: "gpt-5.2-codex",
});

// Do some work...
await session.sendPrompt({ content: "Analyze my codebase" });

// Session state is automatically persisted
// You can safely close the client
```

### Python

```python
from copilot import CopilotClient

client = CopilotClient()

# Create a session with a meaningful ID
session = await client.create_session(
    session_id="user-123-task-456",
    model="gpt-5.2-codex",
)

# Do some work...
await session.send_prompt(content="Analyze my codebase")

# Session state is automatically persisted
```

### Go

```go
client, _ := copilot.NewClient()

// Create a session with a meaningful ID
session, _ := client.CreateSession(copilot.CreateSessionOptions{
    SessionID: "user-123-task-456",
    Model:     "gpt-5.2-codex",
})

// Do some work...
session.SendPrompt(copilot.PromptOptions{Content: "Analyze my codebase"})

// Session state is automatically persisted
```

### C# (.NET)

```csharp
using GitHub.Copilot.SDK;

var client = new CopilotClient();

// Create a session with a meaningful ID
var session = await client.CreateSessionAsync(new CreateSessionOptions
{
    SessionId = "user-123-task-456",
    Model = "gpt-5.2-codex",
});

// Do some work...
await session.SendPromptAsync(new PromptOptions { Content = "Analyze my codebase" });

// Session state is automatically persisted
```

## Resuming a Session

Later—minutes, hours, or even days—you can resume the session from where you left off.

```mermaid
flowchart TB
    subgraph Day1["Client A (Day 1)"]
        A1[createSession<br/>id: task-456] --> A2[Work...<br/>Messages<br/>Tool calls]
    end
    
    subgraph Day2["Client B (Day 2)"]
        B1[resumeSession<br/>id: task-456] --> B2[Continue from<br/>where you left off]
    end
    
    subgraph Storage["~/.copilot/session-state/task-456/"]
        S1[checkpoints/]
        S2[plan.md]
        S3[files/]
    end
    
    A2 --> |"persist"| Storage
    Storage --> |"restore"| B1
```

### TypeScript

```typescript
// Resume from a different client instance (or after restart)
const session = await client.resumeSession("user-123-task-456");

// Continue where you left off
await session.sendPrompt({ content: "What did we discuss earlier?" });
```

### Python

```python
# Resume from a different client instance (or after restart)
session = await client.resume_session("user-123-task-456")

# Continue where you left off
await session.send_prompt(content="What did we discuss earlier?")
```

### Go

```go
// Resume from a different client instance (or after restart)
session, _ := client.ResumeSession("user-123-task-456", copilot.ResumeSessionOptions{})

// Continue where you left off
session.SendPrompt(copilot.PromptOptions{Content: "What did we discuss earlier?"})
```

### C# (.NET)

```csharp
// Resume from a different client instance (or after restart)
var session = await client.ResumeSessionAsync("user-123-task-456");

// Continue where you left off
await session.SendPromptAsync(new PromptOptions { Content = "What did we discuss earlier?" });
```

## Using BYOK (Bring Your Own Key) with Resumed Sessions

When using your own API keys, you must re-provide the provider configuration when resuming. API keys are never persisted to disk for security reasons.

```typescript
// Original session with BYOK
const session = await client.createSession({
  sessionId: "user-123-task-456",
  model: "gpt-5.2-codex",
  provider: {
    type: "azure",
    endpoint: "https://my-resource.openai.azure.com",
    apiKey: process.env.AZURE_OPENAI_KEY,
    deploymentId: "my-gpt-deployment",
  },
});

// When resuming, you MUST re-provide the provider config
const resumed = await client.resumeSession("user-123-task-456", {
  provider: {
    type: "azure",
    endpoint: "https://my-resource.openai.azure.com",
    apiKey: process.env.AZURE_OPENAI_KEY,  // Required again
    deploymentId: "my-gpt-deployment",
  },
});
```

## What Gets Persisted?

Session state is saved to `~/.copilot/session-state/{sessionId}/`:

```
~/.copilot/session-state/
└── user-123-task-456/
    ├── checkpoints/           # Conversation history snapshots
    │   ├── 001.json          # Initial state
    │   ├── 002.json          # After first interaction
    │   └── ...               # Incremental checkpoints
    ├── plan.md               # Agent's planning state (if any)
    └── files/                # Session artifacts
        ├── analysis.md       # Files the agent created
        └── notes.txt         # Working documents
```

| Data | Persisted? | Notes |
|------|------------|-------|
| Conversation history | ✅ Yes | Full message thread |
| Tool call results | ✅ Yes | Cached for context |
| Agent planning state | ✅ Yes | `plan.md` file |
| Session artifacts | ✅ Yes | In `files/` directory |
| Provider/API keys | ❌ No | Security: must re-provide |
| In-memory tool state | ❌ No | Tools should be stateless |

## Session ID Best Practices

Choose session IDs that encode ownership and purpose. This makes auditing and cleanup much easier.

```mermaid
flowchart TB
    subgraph Bad["❌ Bad: Random IDs"]
        B1["abc123"]
        B2["session-7f3d2a1b"]
    end
    
    subgraph Good["✅ Good: Structured IDs"]
        G1["user-{userId}-{taskId}"]
        G2["tenant-{tenantId}-{workflow}"]
        G3["{userId}-{taskId}-{timestamp}"]
    end
    
    subgraph Examples["Examples"]
        E1["user-alice-pr-review-42"]
        E2["tenant-acme-onboarding"]
        E3["alice-deploy-1706932800"]
    end
    
    G1 --> E1
    G2 --> E2
    G3 --> E3
```

**Benefits of structured IDs:**
- Easy to audit: "Show all sessions for user alice"
- Easy to clean up: "Delete all sessions older than X"
- Natural access control: Parse user ID from session ID

### Example: Generating Session IDs

```typescript
function createSessionId(userId: string, taskType: string): string {
  const timestamp = Date.now();
  return `${userId}-${taskType}-${timestamp}`;
}

const sessionId = createSessionId("alice", "code-review");
// → "alice-code-review-1706932800000"
```

```python
import time

def create_session_id(user_id: str, task_type: str) -> str:
    timestamp = int(time.time())
    return f"{user_id}-{task_type}-{timestamp}"

session_id = create_session_id("alice", "code-review")
# → "alice-code-review-1706932800"
```

## Managing Session Lifecycle

### Listing Active Sessions

```typescript
const sessions = await client.listSessions();
console.log(`Found ${sessions.length} sessions`);

for (const session of sessions) {
  console.log(`- ${session.sessionId} (created: ${session.createdAt})`);
}
```

### Cleaning Up Old Sessions

```typescript
async function cleanupExpiredSessions(maxAgeMs: number) {
  const sessions = await client.listSessions();
  const now = Date.now();
  
  for (const session of sessions) {
    const age = now - new Date(session.createdAt).getTime();
    if (age > maxAgeMs) {
      await client.deleteSession(session.sessionId);
      console.log(`Deleted expired session: ${session.sessionId}`);
    }
  }
}

// Clean up sessions older than 24 hours
await cleanupExpiredSessions(24 * 60 * 60 * 1000);
```

### Explicit Session Destruction

When a task completes, destroy the session explicitly rather than waiting for timeouts:

```typescript
try {
  // Do work...
  await session.sendPrompt({ content: "Complete the task" });
  
  // Task complete - clean up
  await session.destroy();
} catch (error) {
  // Clean up even on error
  await session.destroy();
  throw error;
}
```

## Automatic Cleanup: Idle Timeout

The CLI has a built-in 30-minute idle timeout. Sessions without activity are automatically cleaned up:

```mermaid
timeline
    title Session Idle Timeout
    section Active
        Last Activity : Session in use
    section Warning
        25 minutes : session.timeout_warning event
    section Cleanup
        30 minutes : session.destroyed event
```

Listen for idle events to know when work completes:

```typescript
session.on("session.idle", (event) => {
  console.log(`Session idle for ${event.idleDurationMs}ms`);
});
```

## Deployment Patterns

### Pattern 1: One CLI Server Per User (Recommended)

Best for: Strong isolation, multi-tenant environments, Azure Dynamic Sessions.

```mermaid
flowchart TB
    subgraph Users
        UA[User A Client]
        UB[User B Client]
        UC[User C Client]
    end
    
    subgraph Isolated["Isolated Containers"]
        UA --> CA[CLI Server A]
        UB --> CB[CLI Server B]
        UC --> CC[CLI Server C]
        
        CA --> SA[(Session Storage A)]
        CB --> SB[(Session Storage B)]
        CC --> SC[(Session Storage C)]
    end
    
    style CA fill:#90EE90
    style CB fill:#90EE90
    style CC fill:#90EE90
```

**Benefits:** ✅ Complete isolation | ✅ Simple security | ✅ Easy scaling

### Pattern 2: Shared CLI Server (Resource Efficient)

Best for: Internal tools, trusted environments, resource-constrained setups.

```mermaid
flowchart TB
    subgraph Users
        UA[User A Client]
        UB[User B Client]
        UC[User C Client]
    end
    
    UA --> CLI
    UB --> CLI
    UC --> CLI
    
    CLI[Shared CLI Server]
    
    CLI --> SA[Session A<br/>user-a-*]
    CLI --> SB[Session B<br/>user-b-*]
    CLI --> SC[Session C<br/>user-c-*]
    
    style CLI fill:#FFD700
```

**Requirements:**
- ⚠️ Unique session IDs per user
- ⚠️ Application-level access control
- ⚠️ Session ID validation before operations

```typescript
// Application-level access control for shared CLI
async function resumeSessionWithAuth(
  client: CopilotClient,
  sessionId: string,
  currentUserId: string
): Promise<Session> {
  // Parse user from session ID
  const [sessionUserId] = sessionId.split("-");
  
  if (sessionUserId !== currentUserId) {
    throw new Error("Access denied: session belongs to another user");
  }
  
  return client.resumeSession(sessionId);
}
```

## Azure Dynamic Sessions

For serverless/container deployments where containers can restart or migrate:

### Mount Persistent Storage

The session state directory must be mounted to persistent storage:

```yaml
# Azure Container Instance example
containers:
  - name: copilot-agent
    image: my-agent:latest
    volumeMounts:
      - name: session-storage
        mountPath: /home/app/.copilot/session-state

volumes:
  - name: session-storage
    azureFile:
      shareName: copilot-sessions
      storageAccountName: myaccount
```

```mermaid
flowchart TB
    subgraph ContainerA["Container A (original)"]
        CLI1[CLI Server<br/>Session X]
    end
    
    subgraph ContainerB["Container B (after restart)"]
        CLI2[CLI Server<br/>Session X]
    end
    
    subgraph Azure["Azure File Share (Persistent)"]
        FS["/session-state/<br/>└── session-x/<br/>    ├── checkpoints/<br/>    └── plan.md"]
    end
    
    CLI1 --> |"persist"| Azure
    Azure --> |"restore"| CLI2
    
    style Azure fill:#0078D4,color:#fff
```

**Session survives container restarts!**

## Infinite Sessions for Long-Running Workflows

For workflows that might exceed context limits, enable infinite sessions with automatic compaction:

```typescript
const session = await client.createSession({
  sessionId: "long-workflow-123",
  infiniteSessions: {
    enabled: true,
    backgroundCompactionThreshold: 0.80,  // Start compaction at 80% context
    bufferExhaustionThreshold: 0.95,      // Block at 95% if needed
  },
});
```

> **Note:** Thresholds are context utilization ratios (0.0-1.0), not absolute token counts. See the [Compatibility Guide](../compatibility.md) for details.

## Limitations & Considerations

| Limitation | Description | Mitigation |
|------------|-------------|------------|
| **BYOK re-authentication** | API keys aren't persisted | Store keys in your secret manager; provide on resume |
| **Writable storage** | `~/.copilot/session-state/` must be writable | Mount persistent volume in containers |
| **No session locking** | Concurrent access to same session is undefined | Implement application-level locking or queue |
| **Tool state not persisted** | In-memory tool state is lost | Design tools to be stateless or persist their own state |

### Handling Concurrent Access

The SDK doesn't provide built-in session locking. If multiple clients might access the same session:

```typescript
// Option 1: Application-level locking with Redis
import Redis from "ioredis";

const redis = new Redis();

async function withSessionLock<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = `session-lock:${sessionId}`;
  const acquired = await redis.set(lockKey, "locked", "NX", "EX", 300);
  
  if (!acquired) {
    throw new Error("Session is in use by another client");
  }
  
  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
  }
}

// Usage
await withSessionLock("user-123-task-456", async () => {
  const session = await client.resumeSession("user-123-task-456");
  await session.sendPrompt({ content: "Continue the task" });
});
```

## Summary

| Feature | How to Use |
|---------|------------|
| **Create resumable session** | Provide your own `sessionId` |
| **Resume session** | `client.resumeSession(sessionId)` |
| **BYOK resume** | Re-provide `provider` config |
| **List sessions** | `client.listSessions()` |
| **Delete session** | `client.deleteSession(sessionId)` |
| **Destroy active session** | `session.destroy()` |
| **Containerized deployment** | Mount `~/.copilot/session-state/` to persistent storage |

## Next Steps

- [Hooks Overview](../hooks/overview.md) - Customize session behavior with hooks
- [Compatibility Guide](../compatibility.md) - SDK vs CLI feature comparison
- [Debugging Guide](../debugging.md) - Troubleshoot session issues
