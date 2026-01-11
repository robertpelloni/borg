/**
 * WorldEvent: discriminated union of all event types in the system.
 *
 * Used for durable event streaming with cursor-based pagination.
 * Each event has type, offset, timestamp, upToDate signal, and type-specific payload.
 */

import { Schema as S } from "effect"
import { EventOffset } from "./cursor.js"

/**
 * Base event structure shared by all event types.
 */
const BaseEvent = S.Struct({
	offset: EventOffset,
	timestamp: S.Number,
	upToDate: S.Boolean,
})

/**
 * Session lifecycle events
 */
const SessionCreated = S.Struct({
	type: S.Literal("session.created"),
	...BaseEvent.fields,
	payload: S.Struct({
		id: S.String,
		projectKey: S.String,
	}),
})

const SessionUpdated = S.Struct({
	type: S.Literal("session.updated"),
	...BaseEvent.fields,
	payload: S.Struct({
		id: S.String,
		status: S.String,
	}),
})

const SessionCompleted = S.Struct({
	type: S.Literal("session.completed"),
	...BaseEvent.fields,
	payload: S.Struct({
		id: S.String,
		exitCode: S.Number,
	}),
})

/**
 * Worker lifecycle events
 */
const WorkerSpawned = S.Struct({
	type: S.Literal("worker.spawned"),
	...BaseEvent.fields,
	payload: S.Struct({
		workerId: S.String,
		taskId: S.String,
	}),
})

const WorkerProgress = S.Struct({
	type: S.Literal("worker.progress"),
	...BaseEvent.fields,
	payload: S.Struct({
		workerId: S.String,
		percent: S.Number,
	}),
})

const WorkerCompleted = S.Struct({
	type: S.Literal("worker.completed"),
	...BaseEvent.fields,
	payload: S.Struct({
		workerId: S.String,
		success: S.Boolean,
	}),
})

const WorkerFailed = S.Struct({
	type: S.Literal("worker.failed"),
	...BaseEvent.fields,
	payload: S.Struct({
		workerId: S.String,
		error: S.String,
	}),
})

/**
 * Message events (agent communication)
 */
const MessageSent = S.Struct({
	type: S.Literal("message.sent"),
	...BaseEvent.fields,
	payload: S.Struct({
		messageId: S.String,
		from: S.String,
		to: S.String,
	}),
})

const MessageReceived = S.Struct({
	type: S.Literal("message.received"),
	...BaseEvent.fields,
	payload: S.Struct({
		messageId: S.String,
		recipient: S.String,
	}),
})

/**
 * Reservation events (file locking)
 */
const ReservationAcquired = S.Struct({
	type: S.Literal("reservation.acquired"),
	...BaseEvent.fields,
	payload: S.Struct({
		reservationId: S.String,
		agentId: S.String,
		path: S.String,
	}),
})

const ReservationReleased = S.Struct({
	type: S.Literal("reservation.released"),
	...BaseEvent.fields,
	payload: S.Struct({
		reservationId: S.String,
	}),
})

/**
 * WorldEvent: discriminated union of all event types.
 *
 * Discriminator: `type` field
 *
 * Event categories:
 * - session.* - Session lifecycle
 * - worker.* - Worker lifecycle
 * - message.* - Agent communication
 * - reservation.* - File locking
 *
 * @example
 * ```typescript
 * const event = S.decodeSync(WorldEvent)({
 *   type: "session.created",
 *   offset: "12345",
 *   timestamp: Date.now(),
 *   upToDate: false,
 *   payload: { id: "session-123", projectKey: "/path" }
 * });
 *
 * if (event.type === "session.created") {
 *   console.log(event.payload.projectKey); // Type-safe!
 * }
 * ```
 */
export const WorldEvent = S.Union(
	SessionCreated,
	SessionUpdated,
	SessionCompleted,
	WorkerSpawned,
	WorkerProgress,
	WorkerCompleted,
	WorkerFailed,
	MessageSent,
	MessageReceived,
	ReservationAcquired,
	ReservationReleased,
)

export type WorldEvent = S.Schema.Type<typeof WorldEvent>
