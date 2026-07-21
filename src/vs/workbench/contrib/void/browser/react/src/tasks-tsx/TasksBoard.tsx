/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react'
import { Columns3, List, X } from 'lucide-react'
import { Column, Issue, Project } from './kaneoTypes.js'
import { IssueCard } from './IssueCard.js'
import { IssueRow } from './IssueRow.js'
import { columnIcon } from './statusMeta.js'

// A drop target is either one of the project's real columns, or the synthetic
// "no column" bucket (columnId === null) for tasks Kaneo left unassigned to a column.
const NO_COLUMN_KEY = '__no_column__'

export const TasksBoard = ({
	projects,
	selectedProjectId,
	onSelectProject,
	columns,
	issues,
	viewMode,
	onChangeViewMode,
	onChangeColumn,
}: {
	projects: Project[]
	selectedProjectId: string | undefined
	onSelectProject: (id: string) => void
	columns: Column[]
	issues: Issue[]
	viewMode: 'board' | 'list'
	onChangeViewMode: (m: 'board' | 'list') => void
	onChangeColumn: (issueId: string, columnId: string | null) => void
}) => {
	const [dragOverKey, setDragOverKey] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	const sortedColumns = useMemo(
		() => [...columns].sort((a, b) => a.position - b.position),
		[columns],
	)

	const filteredIssues = useMemo(() => {
		const q = search.trim().toLowerCase()
		return [...issues]
			.filter(i => !q || i.title.toLowerCase().includes(q))
			.sort((a, b) => b.updatedAtMs - a.updatedAtMs)
	}, [issues, search])

	const noColumnIssues = filteredIssues.filter(i => !i.columnId)

	return <div className='flex-1 min-w-0 flex flex-col w-full'>
		{/* Preferences-like: top gap + page title */}
		<div className='w-full max-w-4xl mx-auto px-6 pt-12'>
			<h1 className='text-3xl font-bold text-void-fg-1'>Tasks</h1>
		</div>

		{/* Project tabs */}
		<div className='w-full max-w-4xl mx-auto px-6 pt-6 flex items-center gap-1 min-w-0 overflow-x-auto'>
			{projects.map(p => {
				const selected = p.id === selectedProjectId
				return (
					<button
						key={p.id}
						type='button'
						onClick={() => onSelectProject(p.id)}
						className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selected
							? 'bg-void-bg-1 text-void-fg-1'
							: 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1/60'
							}`}
					>
						<span className='truncate max-w-[9rem] inline-block align-bottom'>{p.name}</span>
					</button>
				)
			})}
		</div>

		{/* Search (left) + List/Board (right) */}
		<div className='w-full max-w-4xl mx-auto px-6 pt-5 pb-4 flex items-center justify-between gap-3'>
			<div className='flex items-center gap-2 bg-void-bg-1 rounded-lg px-3 py-1.5 w-64 max-w-full'>
				<input
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder='Search issues...'
					className='bg-transparent outline-none text-sm text-void-fg-1 placeholder:text-void-fg-3 w-full'
				/>
				{search && (
					<button type='button' onClick={() => setSearch('')} className='text-void-fg-3 hover:text-void-fg-1' title='Clear search'>
						<X size={12} />
					</button>
				)}
			</div>
			<div className='flex items-center gap-0.5 shrink-0'>
				<button
					type='button'
					onClick={() => onChangeViewMode('board')}
					className={`p-2 rounded-lg ${viewMode === 'board' ? 'bg-void-bg-1 text-void-fg-1' : 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1/60'}`}
					data-tooltip-id='void-tooltip'
					data-tooltip-content='Board'
					data-tooltip-place='bottom'
					aria-label='Board'
				>
					<Columns3 size={16} strokeWidth={2} />
				</button>
				<button
					type='button'
					onClick={() => onChangeViewMode('list')}
					className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-void-bg-1 text-void-fg-1' : 'text-void-fg-3 hover:text-void-fg-1 hover:bg-void-bg-1/60'}`}
					data-tooltip-id='void-tooltip'
					data-tooltip-content='List'
					data-tooltip-place='bottom'
					aria-label='List'
				>
					<List size={16} strokeWidth={2} />
				</button>
			</div>
		</div>

		{/* Issues */}
		<div className='w-full max-w-4xl mx-auto px-6 pb-8 min-w-0 flex-1'>
			{viewMode === 'board' ? (
				<div className='flex gap-4 overflow-x-auto min-h-0'>
					{sortedColumns.map(column => {
						const colIssues = filteredIssues.filter(i => i.columnId === column.id)
						return (
							<div key={column.id} className='w-[240px] shrink-0'>
								<div className='flex items-center gap-1.5 text-sm font-medium text-void-fg-2 mb-2 px-1'>
									{columnIcon(column, 12)}
									<span>{column.name}</span>
									<span className='text-void-fg-3 font-normal'>{colIssues.length}</span>
								</div>
								<div
									onDragOver={(e) => { e.preventDefault(); if (dragOverKey !== column.id) setDragOverKey(column.id) }}
									onDragLeave={() => setDragOverKey(cur => cur === column.id ? null : cur)}
									onDrop={(e) => {
										e.preventDefault()
										const issueId = e.dataTransfer.getData('text/plain')
										if (issueId) onChangeColumn(issueId, column.id)
										setDragOverKey(null)
									}}
									className={`flex flex-col gap-2 min-h-[60px] rounded-lg p-0.5 transition-colors ${dragOverKey === column.id ? 'bg-void-bg-1/60 ring-1 ring-void-border-1' : ''}`}
								>
									{colIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
								</div>
							</div>
						)
					})}
					{noColumnIssues.length > 0 && (
						<div className='w-[240px] shrink-0'>
							<div className='flex items-center gap-1.5 text-sm font-medium text-void-fg-2 mb-2 px-1'>
								{columnIcon(null, 12)}
								<span>No status</span>
								<span className='text-void-fg-3 font-normal'>{noColumnIssues.length}</span>
							</div>
							<div
								onDragOver={(e) => { e.preventDefault(); if (dragOverKey !== NO_COLUMN_KEY) setDragOverKey(NO_COLUMN_KEY) }}
								onDragLeave={() => setDragOverKey(cur => cur === NO_COLUMN_KEY ? null : cur)}
								onDrop={(e) => {
									e.preventDefault()
									const issueId = e.dataTransfer.getData('text/plain')
									if (issueId) onChangeColumn(issueId, null)
									setDragOverKey(null)
								}}
								className={`flex flex-col gap-2 min-h-[60px] rounded-lg p-0.5 transition-colors ${dragOverKey === NO_COLUMN_KEY ? 'bg-void-bg-1/60 ring-1 ring-void-border-1' : ''}`}
							>
								{noColumnIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
							</div>
						</div>
					)}
				</div>
			) : (
				<div className='flex flex-col'>
					{filteredIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
				</div>
			)}
		</div>
	</div>
}
