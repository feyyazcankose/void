/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { ChatMessage } from './chatThreadServiceTypes.js'
import { RawToolParamsObj } from './sendLLMMessageTypes.js'
import { BuiltinToolCallParams } from './toolsServiceTypes.js'
import { VoidCliToolEvent } from './voidCliToolProtocol.js'

export const VOID_CLI_DISPLAY_ONLY_KEY = '_voidCliDisplayOnly'

function str(v: unknown): string | undefined {
	return typeof v === 'string' && v.length ? v : undefined
}

function pathUri(input: Record<string, unknown>): URI | undefined {
	const p = str(input.file_path) ?? str(input.path) ?? str(input.target)
	if (!p) return undefined
	return URI.file(p)
}

/** Line-level +N -M from Claude Edit old_string / new_string. */
export function lineDiffStats(oldStr: string, newStr: string): { added: number; removed: number } {
	const a = oldStr.split('\n')
	const b = newStr.split('\n')
	if (oldStr === newStr) return { added: 0, removed: 0 }
	return { added: b.length, removed: a.length }
}

function toSearchReplaceBlocks(oldStr: string, newStr: string): string {
	return `<<<<<<< SEARCH\n${oldStr}\n=======\n${newStr}\n>>>>>>> REPLACE`
}

function rawFromInput(input: Record<string, unknown>, extra?: Record<string, string>): RawToolParamsObj {
	return {
		[VOID_CLI_DISPLAY_ONLY_KEY]: '1',
		...Object.fromEntries(
			Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
		),
		...extra,
	} as RawToolParamsObj
}

/**
 * Map a Claude CLI tool_use event to a display-only Void tool success message.
 * Returns null for tools we cannot usefully show.
 */
export function mapClaudeCliToolToVoidDisplay(evt: VoidCliToolEvent): ChatMessage | null {
	const name = evt.name
	const input = evt.input || {}
	const id = generateUuid()

	if (name === 'Read') {
		const uri = pathUri(input)
		if (!uri) return null
		const params: BuiltinToolCallParams['read_file'] = {
			uri,
			startLine: typeof input.offset === 'number' ? input.offset : null,
			endLine: typeof input.limit === 'number' && typeof input.offset === 'number'
				? (input.offset as number) + (input.limit as number)
				: null,
			pageNumber: 1,
		}
		return {
			role: 'tool',
			type: 'success',
			name: 'read_file',
			params,
			result: { fileContents: '', totalFileLen: 0, totalNumLines: 0, hasNextPage: false },
			content: '(Claude CLI Read)',
			id,
			rawParams: rawFromInput(input),
			mcpServerName: undefined,
		}
	}

	if (name === 'Edit') {
		const uri = pathUri(input)
		if (!uri) return null
		const oldStr = str(input.old_string) ?? ''
		const newStr = str(input.new_string) ?? ''
		const params: BuiltinToolCallParams['edit_file'] = {
			uri,
			searchReplaceBlocks: (oldStr || newStr) ? toSearchReplaceBlocks(oldStr, newStr) : '',
		}
		const { added, removed } = lineDiffStats(oldStr, newStr)
		return {
			role: 'tool',
			type: 'success',
			name: 'edit_file',
			params,
			result: { lintErrors: null },
			content: '(Claude CLI Edit)',
			id,
			rawParams: rawFromInput(input, { _added: String(added), _removed: String(removed) }),
			mcpServerName: undefined,
		}
	}

	if (name === 'Write') {
		const uri = pathUri(input)
		if (!uri) return null
		const content = str(input.content) ?? ''
		const params: BuiltinToolCallParams['rewrite_file'] = { uri, newContent: content }
		const lines = content ? content.split('\n').length : 0
		return {
			role: 'tool',
			type: 'success',
			name: 'rewrite_file',
			params,
			result: { lintErrors: null },
			content: '(Claude CLI Write)',
			id,
			rawParams: rawFromInput(input, { _added: String(lines), _removed: '0' }),
			mcpServerName: undefined,
		}
	}

	if (name === 'Bash') {
		const command = str(input.command) ?? ''
		if (!command) return null
		const params: BuiltinToolCallParams['run_command'] = {
			command,
			cwd: str(input.cwd) ?? null,
			terminalId: id,
		}
		return {
			role: 'tool',
			type: 'success',
			name: 'run_command',
			params,
			result: { result: '', resolveReason: { type: 'done', exitCode: 0 } },
			content: '(Claude CLI Bash)',
			id,
			rawParams: rawFromInput(input),
			mcpServerName: undefined,
		}
	}

	if (name === 'Glob') {
		const query = str(input.pattern) ?? str(input.glob) ?? ''
		if (!query) return null
		const params: BuiltinToolCallParams['search_pathnames_only'] = {
			query,
			includePattern: null,
			pageNumber: 1,
		}
		return {
			role: 'tool',
			type: 'success',
			name: 'search_pathnames_only',
			params,
			result: { uris: [], hasNextPage: false },
			content: '(Claude CLI Glob)',
			id,
			rawParams: rawFromInput(input),
			mcpServerName: undefined,
		}
	}

	if (name === 'Grep') {
		const query = str(input.pattern) ?? str(input.query) ?? ''
		if (!query) return null
		const folder = str(input.path)
		const params: BuiltinToolCallParams['search_for_files'] = {
			query,
			isRegex: true,
			searchInFolder: folder ? URI.file(folder) : null,
			pageNumber: 1,
		}
		return {
			role: 'tool',
			type: 'success',
			name: 'search_for_files',
			params,
			result: { uris: [], hasNextPage: false },
			content: '(Claude CLI Grep)',
			id,
			rawParams: rawFromInput(input),
			mcpServerName: undefined,
		}
	}

	if (name === 'LS') {
		const uri = pathUri(input) ?? URI.file('.')
		const params: BuiltinToolCallParams['ls_dir'] = { uri, pageNumber: 1 }
		return {
			role: 'tool',
			type: 'success',
			name: 'ls_dir',
			params,
			result: { children: null, hasNextPage: false, hasPrevPage: false, itemsRemaining: 0 },
			content: '(Claude CLI LS)',
			id,
			rawParams: rawFromInput(input),
			mcpServerName: undefined,
		}
	}

	return null
}

export function isVoidCliDisplayOnlyTool(rawParams: RawToolParamsObj | undefined): boolean {
	return (rawParams as Record<string, string | undefined> | undefined)?.[VOID_CLI_DISPLAY_ONLY_KEY] === '1'
}
