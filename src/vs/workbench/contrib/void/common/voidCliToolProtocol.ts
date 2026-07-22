/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/** Claude CLI bridge embeds tool_use as content sentinels; LLM stream strips them into events. */

export const VOID_CLI_TOOL_SENTINEL_START = '\x1evoid_cli_tool:'
export const VOID_CLI_TOOL_SENTINEL_END = '\x1e'

export type VoidCliToolEvent = {
	name: string
	input: Record<string, unknown>
}

export function encodeVoidCliToolEvent(evt: VoidCliToolEvent): string {
	return `${VOID_CLI_TOOL_SENTINEL_START}${JSON.stringify(evt)}${VOID_CLI_TOOL_SENTINEL_END}`
}

/**
 * Incremental splitter: Claude SSE content chunks may split a sentinel mid-way.
 * Returns prose text safe for the assistant bubble + completed tool events.
 */
export class VoidCliToolContentSplitter {
	private _buf = ''

	push(chunk: string): { text: string; tools: VoidCliToolEvent[] } {
		this._buf += chunk
		const tools: VoidCliToolEvent[] = []
		let textOut = ''

		while (true) {
			const start = this._buf.indexOf(VOID_CLI_TOOL_SENTINEL_START)
			if (start === -1) {
				const keep = Math.min(VOID_CLI_TOOL_SENTINEL_START.length - 1, this._buf.length)
				if (this._buf.length > keep) {
					textOut += this._buf.slice(0, this._buf.length - keep)
					this._buf = this._buf.slice(this._buf.length - keep)
				}
				break
			}

			textOut += this._buf.slice(0, start)
			const after = start + VOID_CLI_TOOL_SENTINEL_START.length
			const end = this._buf.indexOf(VOID_CLI_TOOL_SENTINEL_END, after)
			if (end === -1) {
				this._buf = this._buf.slice(start)
				break
			}

			const json = this._buf.slice(after, end)
			this._buf = this._buf.slice(end + VOID_CLI_TOOL_SENTINEL_END.length)
			try {
				const parsed = JSON.parse(json) as { name?: unknown; input?: unknown }
				if (typeof parsed?.name === 'string') {
					tools.push({
						name: parsed.name,
						input: (parsed.input && typeof parsed.input === 'object' && !Array.isArray(parsed.input))
							? parsed.input as Record<string, unknown>
							: {},
					})
				}
			} catch {
				// ignore malformed sentinel payloads
			}
		}

		return { text: textOut, tools }
	}

	flush(): { text: string; tools: VoidCliToolEvent[] } {
		const text = this._buf
		this._buf = ''
		return { text, tools: [] }
	}
}
