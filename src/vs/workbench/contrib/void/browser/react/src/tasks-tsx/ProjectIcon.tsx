/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { projectIcons } from './projectIcons.js'

const DEFAULT_ICON = projectIcons.Layout

/** Renders Kaneo's project.icon (Lucide name). Use muted for chrome (tabs); color only when asked. */
export const ProjectIcon = ({
	name,
	color,
	size = 14,
	className,
	muted = false,
}: {
	name?: string | null
	color?: string | null
	size?: number
	className?: string
	/** Ignore Kaneo iconColor — use current text color (for tabs / chrome). */
	muted?: boolean
}) => {
	const Icon = (name && projectIcons[name]) || DEFAULT_ICON
	return (
		<Icon
			size={size}
			className={className ?? (muted ? 'shrink-0 text-void-fg-3' : 'shrink-0')}
			strokeWidth={2}
			style={muted ? undefined : { color: color?.trim() || '#64748b' }}
		/>
	)
}
