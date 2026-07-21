/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react'
import { Bot } from 'lucide-react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { Issue } from './kaneoTypes.js'
import { columnIcon } from './statusMeta.js'
import { useAccessor } from '../util/services.js'
import { VOID_OPEN_TASK_DETAIL_ACTION_ID, VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID } from './commandIds.js'

export const IssueRow = ({ issue }: { issue: Issue }) => {
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

	return <div onClick={openDetail} className='group flex items-center justify-between px-4 py-3 hover:bg-void-bg-1 rounded-md cursor-pointer'>
		<div className='flex items-center gap-3 min-w-0'>
			{columnIcon({ isStarted: issue.columnIsStarted, isFinal: issue.columnIsFinal })}
			<span className='text-sm text-void-fg-1 font-medium truncate'>{issue.title}</span>
			<span className='text-xs text-void-fg-3 shrink-0'>{issue.columnName ?? 'No status'}</span>
		</div>
		<div className='flex items-center gap-2 shrink-0 ml-4'>
			<span className='text-xs text-void-fg-3'>{fromNow(issue.updatedAtMs, true)}</span>
			<button
				type='button'
				aria-label='Send to agent'
				data-tooltip-id='void-tooltip'
				data-tooltip-content='Send to agent'
				data-tooltip-place='top'
				disabled={sending}
				onClick={sendToAgent}
				className='p-1 rounded-md text-void-fg-3 opacity-0 group-hover:opacity-100 hover:text-void-fg-1 hover:bg-void-bg-2 transition-opacity disabled:opacity-50'
			>
				<Bot size={14} className={sending ? 'animate-pulse' : undefined} />
			</button>
		</div>
	</div>
}
