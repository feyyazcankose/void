/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { Issue } from './kaneoTypes.js'
import { columnIcon } from './statusMeta.js'
import { useAccessor } from '../util/services.js'
import { VOID_OPEN_TASK_DETAIL_ACTION_ID } from './commandIds.js'

export const IssueRow = ({ issue }: { issue: Issue }) => {
	const accessor = useAccessor()

	const openDetail = () => {
		accessor.get('ICommandService').executeCommand(VOID_OPEN_TASK_DETAIL_ACTION_ID, issue.id, issue.title)
	}

	return <div onClick={openDetail} className='flex items-center justify-between px-4 py-3 hover:bg-void-bg-1 rounded-md cursor-pointer'>
		<div className='flex items-center gap-3 min-w-0'>
			{columnIcon({ isStarted: issue.columnIsStarted, isFinal: issue.columnIsFinal })}
			<span className='text-sm text-void-fg-1 font-medium truncate'>{issue.title}</span>
			<span className='text-xs text-void-fg-3 shrink-0'>{issue.columnName ?? 'Durum yok'}</span>
		</div>
		<span className='text-xs text-void-fg-3 shrink-0 ml-4'>{fromNow(issue.updatedAtMs, true)}</span>
	</div>
}
