/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react'
import { Search, ChevronDown, X, Plus, Clock, Archive } from 'lucide-react'
import { Column, Issue } from './kaneoTypes.js'
import { IssueCard } from './IssueCard.js'
import { IssueRow } from './IssueRow.js'
import { columnIcon } from './statusMeta.js'

// A drop target is either one of the project's real columns, or the synthetic
// "no column" bucket (columnId === null) for tasks Kaneo left unassigned to a column.
const NO_COLUMN_KEY = '__no_column__'

export const TasksBoard = ({ columns, issues, viewMode, onChangeViewMode, onChangeColumn }: {
	columns: Column[]
	issues: Issue[]
	viewMode: 'board' | 'list'
	onChangeViewMode: (m: 'board' | 'list') => void
	onChangeColumn: (issueId: string, columnId: string | null) => void
}) => {
	// column key currently under a dragged card, for a drop-target highlight
	const [dragOverKey, setDragOverKey] = useState<string | null>(null)
	// mock-only filter chips: removable in local state, not wired to any real filtering logic yet
	const [chips, setChips] = useState([
		{ key: 'time', icon: <Clock size={13} />, label: 'Time', value: 'Any time' },
		{ key: 'archived', icon: <Archive size={13} />, label: 'Archived', value: 'Excluded' },
	])
	const [search, setSearch] = useState('')

	const sortedIssues = [...issues].sort((a, b) => b.updatedAtMs - a.updatedAtMs)
	const sortedColumns = [...columns].sort((a, b) => a.position - b.position)
	const noColumnIssues = sortedIssues.filter(i => !i.columnId)

	return <div className='flex-1 min-w-0'>
		{/* Board/List toggle */}
		<div className='flex items-center gap-1 px-4 pt-3'>
			<button
				onClick={() => onChangeViewMode('board')}
				className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'board' ? 'bg-void-bg-1 text-void-fg-1' : 'text-void-fg-3 hover:text-void-fg-1'}`}
			>
				Board
			</button>
			<button
				onClick={() => onChangeViewMode('list')}
				className={`px-4 py-1.5 rounded-md text-sm font-medium ${viewMode === 'list' ? 'bg-void-bg-1 text-void-fg-1' : 'text-void-fg-3 hover:text-void-fg-1'}`}
			>
				List
			</button>
		</div>

		{/* Filter bar */}
		<div className='flex items-center justify-between px-4 py-3 gap-2 flex-wrap'>
			<div className='flex items-center gap-2 flex-wrap'>
				{chips.map(c => (
					<div key={c.key} className='flex items-center gap-1.5 text-xs bg-void-bg-1 rounded-full pl-3 pr-1.5 py-1.5 text-void-fg-2'>
						{c.icon}
						<span className='text-void-fg-3'>{c.label}</span>
						<span className='text-void-fg-4'>is</span>
						<span className='text-void-fg-1 font-medium'>{c.value}</span>
						<button
							onClick={() => setChips(cs => cs.filter(x => x.key !== c.key))}
							className='hover:bg-void-bg-2 rounded-full p-0.5 ml-0.5'
						>
							<X size={12} />
						</button>
					</div>
				))}
				{/* mock-only: adding new filters isn't wired up yet */}
				<button className='p-1.5 rounded-full bg-void-bg-1 text-void-fg-3 hover:text-void-fg-1'>
					<Plus size={14} />
				</button>
			</div>
			<div className='flex items-center gap-2'>
				<div className='flex items-center gap-2 bg-void-bg-1 rounded-full px-3 py-1.5 w-64'>
					<Search size={14} className='text-void-fg-3 shrink-0' />
					<input
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder='Search issues...'
						className='bg-transparent outline-none text-sm text-void-fg-1 placeholder:text-void-fg-3 w-full'
					/>
				</div>
				{/* mock-only: Display options aren't wired up yet */}
				<button className='flex items-center gap-1.5 text-sm text-void-fg-2 hover:text-void-fg-1 bg-void-bg-1 rounded-full px-3 py-1.5'>
					Display <ChevronDown size={14} />
				</button>
			</div>
		</div>

		{viewMode === 'board' ? (
			/* Columns - real per-project columns, not a fixed status set */
			<div className='flex flex-wrap gap-6 px-4 pb-4'>
				{sortedColumns.map(column => {
					const colIssues = sortedIssues.filter(i => i.columnId === column.id)
					return (
						<div key={column.id} className='flex-1 min-w-[260px]'>
							<div className='flex items-center gap-1.5 text-sm font-medium text-void-fg-2 mb-3 px-1'>
								{columnIcon(column)}
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
								className={`flex flex-col gap-3 min-h-[60px] rounded-lg p-1 -m-1 transition-colors ${dragOverKey === column.id ? 'bg-void-bg-1/60 ring-1 ring-void-border-1' : ''}`}
							>
								{colIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
							</div>
						</div>
					)
				})}
				{noColumnIssues.length > 0 && (
					<div className='flex-1 min-w-[260px]'>
						<div className='flex items-center gap-1.5 text-sm font-medium text-void-fg-2 mb-3 px-1'>
							{columnIcon(null)}
							<span>Durum yok</span>
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
							className={`flex flex-col gap-3 min-h-[60px] rounded-lg p-1 -m-1 transition-colors ${dragOverKey === NO_COLUMN_KEY ? 'bg-void-bg-1/60 ring-1 ring-void-border-1' : ''}`}
						>
							{noColumnIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
						</div>
					</div>
				)}
			</div>
		) : (
			/* Flat list, most-recently-updated first */
			<div className='flex flex-col px-2 pb-4'>
				{sortedIssues.map(issue => <IssueRow key={issue.id} issue={issue} />)}
			</div>
		)}
	</div>
}
