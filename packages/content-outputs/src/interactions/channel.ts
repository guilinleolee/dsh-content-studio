/**
 * The reserved interaction channel for a future MCP provider. This phase
 * ships the interface (in `./types.ts`) plus this always-failing stub only:
 * `fetchMessages` backs the inbox's disabled pull entry, `sendReply` backs
 * the send button — whose local archive never depends on the call's result.
 * No second abstraction is permitted by the plan; when a real MCP provider
 * lands, it implements this interface and replaces the stub wiring.
 */

import type { InteractionChannel, InteractionChannelFailure, InteractionSendReplyRequest } from './types.ts'

/**
 * The always-failing channel: both methods return `MCP_NOT_CONFIGURED`,
 * forever, until a real provider replaces this object. `satisfies` keeps the
 * narrowed failure-only return types on the literal while checking it
 * against the interface, whose wider union exists for that future provider.
 */
export const stubInteractionChannel = {
  fetchMessages: (): Promise<InteractionChannelFailure> => {
    return Promise.resolve({ ok: false, reason: 'MCP_NOT_CONFIGURED' })
  },
  sendReply: (_request: InteractionSendReplyRequest): Promise<InteractionChannelFailure> => {
    return Promise.resolve({ ok: false, reason: 'MCP_NOT_CONFIGURED' })
  },
} satisfies InteractionChannel
