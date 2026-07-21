/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react'
import { Bot } from 'lucide-react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { Issue } from './kaneoTypes.js'
import { useAccessor } from '../util/services.js'
import { VOID_OPEN_TASK_DETAIL_ACTION_ID, VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID } from './commandIds.js'

export const IssueCard = ({ issue }: { issue: Issue }) => {
	const accessor = useAccessor()
	const [sending, setSending] = useState(false)

	const openDetail = () => {
		accessor.get('ICommandService').executeCommand(VOID_OPEN_TASK_DETAIL_ACTION_ID, issue.id, issue.title)
	}

	const sendToAgent = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (sending) return
		setSending(true)
		try {
			await accessor.get('ICommandService').executeCommand(VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID, issue.id)
		} finally {
			setSending(false)
		}
	}

	return <div
		draggable
		onDragStart={(e) => {
			e.dataTransfer.setData('text/plain', issue.id)
			e.dataTransfer.effectAllowed = 'move'
		}}
		onClick={openDetail}
		className='group relative bg-void-bg-1 rounded-lg px-2.5 py-2 hover:bg-void-bg-1-alt cursor-grab active:cursor-grabbing transition-colors'
	>
		<div className='text-sm text-void-fg-1 font-medium mb-1 leading-snug pr-6'>{issue.title}</div>
		<div className='text-xs text-void-fg-3'>{fromNow(issue.updatedAtMs, true)}</div>
		<button
			type='button'
			aria-label='Send to agent'
			data-tooltip-id='void-tooltip'
			data-tooltip-content='Send to agent'
			data-tooltip-place='top'
			disabled={sending}
			onClick={sendToAgent}
			onMouseDown={e => e.stopPropagation()}
			onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
			draggable={false}
			className='absolute bottom-1.5 right-1.5 p-1 rounded-md text-void-fg-3 opacity-0 group-hover:opacity-100 hover:text-void-fg-1 hover:bg-void-bg-2 transition-opacity disabled:opacity-50'
		>
			<Bot size={14} className={sending ? 'animate-pulse' : undefined} />
		</button>
	</div>
}
