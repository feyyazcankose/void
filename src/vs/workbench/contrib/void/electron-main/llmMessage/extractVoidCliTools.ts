/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { OnText, OnFinalMessage, OnCliToolEvent } from '../../common/sendLLMMessageTypes.js'
import { VoidCliToolContentSplitter } from '../../common/voidCliToolProtocol.js'

/**
 * Strip void_cli_tool sentinels from streaming content (Claude CLI bridge).
 * Emits structured tool events; assistant bubble gets prose only.
 */
export const extractVoidCliToolsWrapper = (
	onText: OnText,
	onFinalMessage: OnFinalMessage,
	onCliToolEvent: OnCliToolEvent | undefined,
): { newOnText: OnText; newOnFinalMessage: OnFinalMessage } => {
	const splitter = new VoidCliToolContentSplitter()
	let lastRawLen = 0
	let cleanFullText = ''
	let cleanFullReasoning = ''

	const emitTools = (tools: Parameters<OnCliToolEvent>[0][]) => {
		if (!onCliToolEvent) return
		for (const t of tools) onCliToolEvent(t)
	}

	const newOnText: OnText = ({ fullText, fullReasoning, toolCall }) => {
		const delta = fullText.slice(lastRawLen)
		lastRawLen = fullText.length
		const { text, tools } = splitter.push(delta)
		emitTools(tools)
		cleanFullText += text
		cleanFullReasoning = fullReasoning
		onText({ fullText: cleanFullText, fullReasoning: cleanFullReasoning, toolCall })
	}

	const newOnFinalMessage: OnFinalMessage = (params) => {
		const { text, tools } = splitter.flush()
		emitTools(tools)
		cleanFullText += text
		onFinalMessage({
			...params,
			fullText: cleanFullText,
			fullReasoning: params.fullReasoning || cleanFullReasoning,
		})
	}

	return { newOnText, newOnFinalMessage }
}
