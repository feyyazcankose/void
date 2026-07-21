/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { Circle, Clock, CheckCircle2 } from 'lucide-react'

// Icon for a task's real column (a project's own columns, not a fixed status set) -
// isFinal/isStarted come straight from Kaneo's columnTable.
export const columnIcon = (column: { isStarted: boolean, isFinal: boolean } | null | undefined, size = 14) => {
	if (column?.isFinal) return <CheckCircle2 size={size} className='text-emerald-500' />
	if (column?.isStarted) return <Clock size={size} className='text-amber-500' />
	return <Circle size={size} className='text-void-fg-3' />
}

// short "RG-2" style project code, e.g. "Rigorent" -> "RG", "Konut Konfor" -> "KK"
export const projectCode = (projectName: string): string => {
	const words = projectName.split(/\s+/).filter(Boolean)
	if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
	return projectName.slice(0, 2).toUpperCase()
}
