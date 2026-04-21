import test from "node:test"
import assert from "node:assert/strict"

import {
  agentSessionReducer,
  initialAgentSessionState,
  resolveTimelineItems,
} from "@/lib/ai-agent/session-state"
import type { AIEvent, SessionView, TaskView } from "@/lib/api/ai-agent"

function buildSessionSnapshot(overrides: Partial<SessionView> = {}): SessionView {
  return {
    id: "session-1",
    model: "gpt-test",
    permission_mode: "balanced",
    status: "idle",
    created_at: "2026-04-20T10:00:00Z",
    updated_at: "2026-04-20T10:00:00Z",
    messages: [],
    tasks: [],
    available_tools: [],
    default_transport: "ws",
    ...overrides,
  }
}

function buildTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: "task-1",
    tool_call_id: "call-1",
    tool_name: "execute_command",
    tool_display_name: "执行命令",
    status: "waiting_confirm",
    dangerous: true,
    requires_confirmation: true,
    created_at: "2026-04-20T10:00:01Z",
    updated_at: "2026-04-20T10:00:01Z",
    ...overrides,
  }
}

test("session.started 会把会话快照归约进状态", () => {
  const next = agentSessionReducer(initialAgentSessionState, {
    type: "event",
    event: {
      id: "evt-1",
      type: "session.started",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:00Z",
      session: buildSessionSnapshot({
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "你好",
            created_at: "2026-04-20T10:00:00Z",
          },
        ],
      }),
    },
  })

  assert.equal(next.session?.id, "session-1")
  assert.equal(next.messagesById["msg-1"]?.content, "你好")
  assert.equal(next.timeline.length, 1)
  assert.equal(next.timeline[0]?.id, "message:msg-1")
})

test("assistant.delta 与 assistant.completed 会正确拼接与收敛消息", () => {
  const deltaEvent: AIEvent = {
    id: "evt-2",
    type: "assistant.delta",
    session_id: "session-1",
    created_at: "2026-04-20T10:00:02Z",
    assistant: {
      message_id: "msg-a",
      delta: "正在",
    },
  }

  const completedEvent: AIEvent = {
    id: "evt-3",
    type: "assistant.completed",
    session_id: "session-1",
    created_at: "2026-04-20T10:00:03Z",
    assistant: {
      message_id: "msg-a",
      content: "正在分析服务器状态。",
    },
  }

  const afterDelta = agentSessionReducer(initialAgentSessionState, {
    type: "event",
    event: deltaEvent,
  })
  const afterCompleted = agentSessionReducer(afterDelta, {
    type: "event",
    event: completedEvent,
  })

  assert.equal(afterDelta.messagesById["msg-a"]?.content, "正在")
  assert.equal(afterDelta.messagesById["msg-a"]?.pending, true)
  assert.equal(afterCompleted.messagesById["msg-a"]?.content, "正在分析服务器状态。")
  assert.equal(afterCompleted.messagesById["msg-a"]?.pending, false)
})

test("任务、确认和错误事件会被归约并解析到时间线", () => {
  const task = buildTask()
  let state = agentSessionReducer(initialAgentSessionState, {
    type: "event",
    event: {
      id: "evt-4",
      type: "task.created",
      session_id: "session-1",
      created_at: task.created_at,
      task,
    },
  })

  state = agentSessionReducer(state, {
    type: "event",
    event: {
      id: "evt-5",
      type: "confirmation.requested",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:02Z",
      confirmation: {
        task_id: task.id,
        status: "waiting_confirm",
        created_at: "2026-04-20T10:00:02Z",
      },
    },
  })

  state = agentSessionReducer(state, {
    type: "event",
    event: {
      id: "evt-6",
      type: "error",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:03Z",
      error: {
        code: "provider_error",
        message: "上游调用失败",
      },
    },
  })

  const timeline = resolveTimelineItems(state)

  assert.equal(state.tasksById[task.id]?.status, "waiting_confirm")
  assert.equal(state.error, "上游调用失败")
  assert.equal(timeline.length, 3)
  assert.equal(timeline[0]?.kind, "task")
  assert.equal(timeline[1]?.kind, "confirmation")
  assert.equal(timeline[2]?.kind, "error")
  assert.equal(timeline[1]?.data?.task_id, task.id)
})

test("session.completed 会合并最终快照但不重复灌入旧用户消息", () => {
  const seeded = agentSessionReducer(initialAgentSessionState, {
    type: "local.user",
    message: {
      id: "msg-user-local",
      role: "user",
      content: "帮我检查服务",
      created_at: "2026-04-20T10:00:00Z",
    },
  })

  const completed = agentSessionReducer(seeded, {
    type: "event",
    event: {
      id: "evt-7",
      type: "session.completed",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:05Z",
      session: buildSessionSnapshot({
        status: "idle",
        messages: [
          {
            id: "msg-user-remote",
            role: "user",
            content: "帮我检查服务",
            created_at: "2026-04-20T10:00:00Z",
          },
          {
            id: "msg-assistant-final",
            role: "assistant",
            content: "检查完成",
            created_at: "2026-04-20T10:00:05Z",
          },
        ],
      }),
    },
  })

  const timeline = resolveTimelineItems(completed)
  const messageIds = timeline
    .filter((item) => item.kind === "message" && item.data)
    .map((item) => item.data!.id)

  assert.deepEqual(messageIds, ["msg-user-local", "msg-assistant-final"])
})

test("本地发送、任务确认事件会驱动会话状态流转", () => {
  const started = agentSessionReducer(initialAgentSessionState, {
    type: "event",
    event: {
      id: "evt-8",
      type: "session.started",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:00Z",
      session: buildSessionSnapshot(),
    },
  })

  const afterLocalUser = agentSessionReducer(started, {
    type: "local.user",
    message: {
      id: "msg-user-local",
      role: "user",
      content: "执行 uptime",
      created_at: "2026-04-20T10:00:01Z",
    },
  })

  const afterWaitingConfirm = agentSessionReducer(afterLocalUser, {
    type: "event",
    event: {
      id: "evt-9",
      type: "task.updated",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:02Z",
      task: buildTask({
        status: "waiting_confirm",
        updated_at: "2026-04-20T10:00:02Z",
      }),
    },
  })

  const afterConfirm = agentSessionReducer(afterWaitingConfirm, {
    type: "event",
    event: {
      id: "evt-10",
      type: "confirmation.resolved",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:03Z",
      confirmation: {
        task_id: "task-1",
        status: "running",
        decision: "confirm",
        created_at: "2026-04-20T10:00:03Z",
      },
    },
  })

  assert.equal(afterLocalUser.session?.status, "running")
  assert.equal(afterWaitingConfirm.session?.status, "waiting_confirmation")
  assert.equal(afterConfirm.session?.status, "running")
})

test("本地用户消息要保持在随后到达的 assistant 事件之前，不受时间戳漂移影响", () => {
  const started = agentSessionReducer(initialAgentSessionState, {
    type: "event",
    event: {
      id: "evt-11",
      type: "session.started",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:00Z",
      session: buildSessionSnapshot(),
    },
  })

  const afterLocalUser = agentSessionReducer(started, {
    type: "local.user",
    message: {
      id: "msg-user-local",
      role: "user",
      content: "你好",
      created_at: "2026-04-20T10:00:05Z",
    },
  })

  const afterAssistant = agentSessionReducer(afterLocalUser, {
    type: "event",
    event: {
      id: "evt-12",
      type: "assistant.completed",
      session_id: "session-1",
      created_at: "2026-04-20T10:00:04Z",
      assistant: {
        message_id: "msg-assistant-1",
        content: "你好，我可以帮你查看服务器。",
      },
    },
  })

  const messageIds = resolveTimelineItems(afterAssistant)
    .filter((item) => item.kind === "message" && item.data)
    .map((item) => item.data!.id)

  assert.deepEqual(messageIds, ["msg-user-local", "msg-assistant-1"])
})
