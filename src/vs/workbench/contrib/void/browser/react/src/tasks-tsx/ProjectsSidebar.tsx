/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { Search, Plus, ArrowUpDown, FolderKanban } from 'lucide-react'
import { Project } from './kaneoTypes.js'

export const ProjectsSidebar = ({ projects, selectedProjectId, onSelectProject, issueCounts }: {
	projects: Project[]
	selectedProjectId: string | undefined
	onSelectProject: (id: string) => void
	issueCounts: Record<string, number>
}) => {
	return <div className='md:w-72 w-full shrink-0 p-3'>
		<div className='flex items-center justify-between px-1 py-2'>
			<span className='text-xs font-medium text-void-fg-3 uppercase tracking-wide'>Projeler</span>
			<div className='flex items-center gap-1 text-void-fg-3'>
				{/* mock-only: not wired to a real search/sort/create flow yet */}
				<button className='hover:text-void-fg-1 p-1' title='Search'><Search size={14} /></button>
				<button className='hover:text-void-fg-1 p-1' title='Sort'><ArrowUpDown size={14} /></button>
				<button className='hover:text-void-fg-1 p-1' title='New project'><Plus size={14} /></button>
			</div>
		</div>
		<div className='flex flex-col gap-2 mt-1'>
			{projects.map(p => {
				const isSelected = p.id === selectedProjectId
				return (
					<div
						key={p.id}
						onClick={() => onSelectProject(p.id)}
						className={`flex items-center gap-2.5 rounded-lg p-3 cursor-pointer transition-colors ${isSelected ? 'bg-void-bg-1 ring-1 ring-void-border-1' : 'bg-void-bg-1/50 hover:bg-void-bg-1'}`}
					>
						<FolderKanban size={16} className={isSelected ? 'text-void-fg-1' : 'text-void-fg-3'} />
						<span className={`flex-1 text-sm truncate ${isSelected ? 'text-void-fg-1 font-medium' : 'text-void-fg-2'}`}>{p.name}</span>
						<span className='text-xs text-void-fg-3 bg-void-bg-2 rounded-full px-2 py-0.5 shrink-0'>{issueCounts[p.id] ?? 0}</span>
					</div>
				)
			})}
		</div>
	</div>
}
