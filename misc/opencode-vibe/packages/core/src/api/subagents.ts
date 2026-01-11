/**
 * Subagents API - Promise-based wrapper
 *
 * Promise-based API for subagent session management.
 * Wraps SubagentAtom Effect programs with Effect.runPromise.
 *
 * @module api/subagents
 */

import { Effect, Ref } from "effect"
import { SubagentAtom } from "../atoms/subagents.js"
import type { SubagentSession, SubagentState } from "../atoms/subagents.js"
import type { Message, Part } from "../types/index.js"

/**
 * Type alias for SubagentState reference
 * Opaque type - consumers shouldn't need to import from "effect"
 */
export type SubagentStateRef = Ref.Ref<SubagentState>

/**
 * Subagent API namespace
 *
 * Promise-based wrappers around SubagentAtom.
 */
export const subagents = {
	/**
	 * Create a new subagent state
	 *
	 * @returns Promise that resolves to a SubagentStateRef
	 */
	create: (): Promise<SubagentStateRef> => Effect.runPromise(SubagentAtom.create()),

	/**
	 * Get the full state from a ref
	 *
	 * @param stateRef - Reference to the subagent state
	 * @returns Promise that resolves to the full state
	 */
	getState: (stateRef: SubagentStateRef): Promise<SubagentState> =>
		Effect.runPromise(Ref.get(stateRef)),

	/**
	 * Register a new subagent session
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param childSessionId - ID of the child session
	 * @param parentSessionId - ID of the parent session
	 * @param parentPartId - ID of the parent part (Task tool part)
	 * @param agentName - Name of the agent
	 * @returns Promise that resolves when registered
	 */
	registerSubagent: (
		stateRef: SubagentStateRef,
		childSessionId: string,
		parentSessionId: string,
		parentPartId: string,
		agentName: string,
	): Promise<void> =>
		Effect.runPromise(
			SubagentAtom.registerSubagent(
				stateRef,
				childSessionId,
				parentSessionId,
				parentPartId,
				agentName,
			),
		),

	/**
	 * Update parent part ID for a session
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param childSessionId - ID of the child session
	 * @param parentPartId - New parent part ID
	 * @returns Promise that resolves when updated
	 */
	updateParentPartId: (
		stateRef: SubagentStateRef,
		childSessionId: string,
		parentPartId: string,
	): Promise<void> =>
		Effect.runPromise(SubagentAtom.updateParentPartId(stateRef, childSessionId, parentPartId)),

	/**
	 * Add a message to a session
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param sessionId - ID of the session
	 * @param message - Message to add
	 * @returns Promise that resolves when added
	 */
	addMessage: (stateRef: SubagentStateRef, sessionId: string, message: Message): Promise<void> =>
		Effect.runPromise(SubagentAtom.addMessage(stateRef, sessionId, message)),

	/**
	 * Update a message in a session
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param sessionId - ID of the session
	 * @param message - Updated message
	 * @returns Promise that resolves when updated
	 */
	updateMessage: (stateRef: SubagentStateRef, sessionId: string, message: Message): Promise<void> =>
		Effect.runPromise(SubagentAtom.updateMessage(stateRef, sessionId, message)),

	/**
	 * Add a part to a message
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param sessionId - ID of the session
	 * @param messageId - ID of the message
	 * @param part - Part to add
	 * @returns Promise that resolves when added
	 */
	addPart: (
		stateRef: SubagentStateRef,
		sessionId: string,
		messageId: string,
		part: Part,
	): Promise<void> => Effect.runPromise(SubagentAtom.addPart(stateRef, sessionId, messageId, part)),

	/**
	 * Update a part in a message
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param sessionId - ID of the session
	 * @param messageId - ID of the message
	 * @param part - Updated part
	 * @returns Promise that resolves when updated
	 */
	updatePart: (
		stateRef: SubagentStateRef,
		sessionId: string,
		messageId: string,
		part: Part,
	): Promise<void> =>
		Effect.runPromise(SubagentAtom.updatePart(stateRef, sessionId, messageId, part)),

	/**
	 * Set the status of a session
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param sessionId - ID of the session
	 * @param status - New status
	 * @returns Promise that resolves when updated
	 */
	setStatus: (
		stateRef: SubagentStateRef,
		sessionId: string,
		status: SubagentSession["status"],
	): Promise<void> => Effect.runPromise(SubagentAtom.setStatus(stateRef, sessionId, status)),

	/**
	 * Toggle expansion state of a part
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param partId - ID of the part
	 * @returns Promise that resolves when toggled
	 */
	toggleExpanded: (stateRef: SubagentStateRef, partId: string): Promise<void> =>
		Effect.runPromise(SubagentAtom.toggleExpanded(stateRef, partId)),

	/**
	 * Check if a part is expanded
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param partId - ID of the part
	 * @returns Promise that resolves to whether the part is expanded
	 */
	isExpanded: (stateRef: SubagentStateRef, partId: string): Promise<boolean> =>
		Effect.runPromise(SubagentAtom.isExpanded(stateRef, partId)),

	/**
	 * Get a session by parent part ID
	 *
	 * @param stateRef - Reference to the subagent state
	 * @param partId - ID of the parent part
	 * @returns Promise that resolves to the session or undefined
	 */
	getByParentPart: (
		stateRef: SubagentStateRef,
		partId: string,
	): Promise<SubagentSession | undefined> =>
		Effect.runPromise(SubagentAtom.getByParentPart(stateRef, partId)),

	/**
	 * Get all sessions
	 *
	 * @param stateRef - Reference to the subagent state
	 * @returns Promise that resolves to all sessions
	 */
	getSessions: (stateRef: SubagentStateRef): Promise<Record<string, SubagentSession>> =>
		Effect.runPromise(SubagentAtom.getSessions(stateRef)),

	/**
	 * Get the part to session mapping
	 *
	 * @param stateRef - Reference to the subagent state
	 * @returns Promise that resolves to the part to session mapping
	 */
	getPartToSession: (stateRef: SubagentStateRef): Promise<Record<string, string>> =>
		Effect.runPromise(SubagentAtom.getPartToSession(stateRef)),
}

// Export types for consumers
export type { SubagentSession, SubagentState }
