/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { Issue } from './kaneoTypes.js'
import { useAccessor } from '../util/services.js'
import { VOID_OPEN_TASK_DETAIL_ACTION_ID } from './commandIds.js'

export const IssueCard = ({ issue }: { issue: Issue }) => {
	const accessor = useAccessor()

	const openDetail = () => {
		accessor.get('ICommandService').executeCommand(VOID_OPEN_TASK_DETAIL_ACTION_ID, issue.id, issue.title)
	}

	return <div
		draggable
		onDragStart={(e) => {
			e.dataTransfer.setData('text/plain', issue.id)
			e.dataTransfer.effectAllowed = 'move'
		}}
		onClick={openDetail}
		className='bg-void-bg-1 rounded-lg p-4 hover:bg-void-bg-1-alt cursor-grab active:cursor-grabbing transition-colors'
	>
		<div className='text-sm text-void-fg-1 font-medium mb-4 leading-snug'>{issue.title}</div>
		<div className='text-xs text-void-fg-3'>{fromNow(issue.updatedAtMs, true)}</div>
	</div>
}
