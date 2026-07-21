/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Paperclip, ArrowUp, Flag, CalendarClock, X, FileText } from 'lucide-react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { columnIcon, projectCode } from '../tasks-tsx/statusMeta.js'
import { Issue, TaskDetailData } from '../tasks-tsx/kaneoTypes.js'
import { useIsDark, useAccessor, useKaneoWsConnected } from '../util/services.js'
import { VOID_OPEN_TASK_DETAIL_ACTION_ID, VOID_TOGGLE_TASKS_ACTION_ID, VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID } from '../tasks-tsx/commandIds.js'

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
	return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const TaskDetail = ({ issueId }: { issueId: string }) => {
	const isDark = useIsDark()
	const accessor = useAccessor()
	const kaneoApi = accessor.get('IKaneoApiService')
	const commandService = accessor.get('ICommandService')
	const openTasksPane = () => commandService.executeCommand(VOID_TOGGLE_TASKS_ACTION_ID)
	const openIssue = (id: string, title: string) => commandService.executeCommand(VOID_OPEN_TASK_DETAIL_ACTION_ID, id, title)
	const agentOnline = useKaneoWsConnected()
	const [triggering, setTriggering] = useState(false)

	const [task, setTask] = useState<TaskDetailData | null | undefined>(undefined) // undefined = loading
	const [projectIssues, setProjectIssues] = useState<Issue[]>([])
	const [subTasksOpen, setSubTasksOpen] = useState(true)
	const [relationsOpen, setRelationsOpen] = useState(true)
	const [filesOpen, setFilesOpen] = useState(true)
	const [addingSubtask, setAddingSubtask] = useState(false)
	const [addingRelation, setAddingRelation] = useState(false)
	const [subtaskTitle, setSubtaskTitle] = useState('')
	const [relationType, setRelationType] = useState<'blocks' | 'related'>('related')
	const [relationTargetId, setRelationTargetId] = useState('')
	const [commentDraft, setCommentDraft] = useState('')
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const reload = useCallback(async () => {
		const t = await kaneoApi.getTaskDetail(issueId)
		setTask(t)
		return t
	}, [kaneoApi, issueId])

	useEffect(() => {
		let cancelled = false
		setTask(undefined)
		setError(null)
		;(async () => {
			try {
				const [t, tasks] = await Promise.all([
					kaneoApi.getTaskDetail(issueId),
					kaneoApi.getMyTasks(),
				])
				if (cancelled) return
				setTask(t)
				setProjectIssues(tasks)
			} catch (e) {
				if (!cancelled) {
					setTask(null)
					setError(e instanceof Error ? e.message : String(e))
				}
			}
		})()
		return () => { cancelled = true }
	}, [kaneoApi, issueId])

	const relationCandidates = useMemo(() => {
		if (!task) return []
		const linked = new Set([
			task.id,
			...(task.subtasks ?? []).map(s => s.id),
			...(task.relations ?? []).map(r => r.relatedTaskId),
		])
		return projectIssues.filter(i => i.projectId === task.projectId && !linked.has(i.id))
	}, [task, projectIssues])

	const runMutation = async (key: string, fn: () => Promise<void>) => {
		setBusy(key)
		setError(null)
		try {
			await fn()
			await reload()
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setBusy(null)
		}
	}

	if (task === undefined) {
		return <div className={`@@void-scope ${isDark ? 'dark' : ''} p-8 text-void-fg-3 text-sm`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			Loading...
		</div>
	}

	if (!task) {
		return <div className={`@@void-scope ${isDark ? 'dark' : ''} p-8 text-void-fg-3 text-sm`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			{error ?? 'This issue no longer exists.'}
		</div>
	}

	const subtasks = task.subtasks ?? []
	const relations = task.relations ?? []
	const attachments = task.attachments ?? []
	const comments = task.comments ?? []

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ height: '100%', width: '100%', overflow: 'auto' }}
	>
		<div className='flex flex-col md:flex-row w-full bg-void-bg-2 text-void-fg-1' style={{ minHeight: '100%' }}>

			{/* Main content */}
			<main className='flex-1 min-w-0 p-8'>
				<div className='flex items-center gap-1.5 text-xs text-void-fg-3 mb-4'>
					<button onClick={openTasksPane} className='hover:text-void-fg-1'>Projects</button>
					<ChevronRight size={12} />
					<button onClick={openTasksPane} className='hover:text-void-fg-1'>{task.projectName}</button>
					<ChevronRight size={12} />
					<span className='text-void-fg-2 font-medium'>{projectCode(task.projectName)}-{task.number ?? '?'}</span>
				</div>
				<h1 className='text-3xl font-bold text-void-fg-1 mb-5 leading-tight'>{task.title}</h1>

				<p className='text-sm text-void-fg-2 leading-relaxed whitespace-pre-wrap'>
					{task.description || 'No description.'}
				</p>

				{error && (
					<div className='mt-3 text-xs text-red-400 bg-red-500/10 rounded px-3 py-2'>{error}</div>
				)}

				{/* Attachments */}
				<div className='border-t border-void-border-2 pt-3 mt-4'>
					<button onClick={() => setFilesOpen(o => !o)} className='flex items-center justify-between w-full text-sm text-void-fg-2'>
						<span className='flex items-center gap-1.5'>
							{filesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
							<Paperclip size={14} />
							Files
							{attachments.length > 0 && <span className='text-void-fg-3'>({attachments.length})</span>}
						</span>
					</button>
					{filesOpen && (
						attachments.length === 0
							? <div className='text-xs text-void-fg-3 mt-2 pl-5'>No files attached</div>
							: <div className='mt-2 pl-5 flex flex-col gap-1.5'>
								{attachments.map(a => (
									<div key={a.id} className='flex items-center gap-2 text-xs text-void-fg-2'>
										<FileText size={13} className='text-void-fg-3 shrink-0' />
										<span className='truncate' title={a.filename}>{a.filename}</span>
										<span className='text-void-fg-3 shrink-0'>{formatBytes(a.size)}</span>
										<span className='text-void-fg-4 shrink-0'>{a.mimeType || a.kind}</span>
									</div>
								))}
							</div>
					)}
				</div>

				{/* Sub-issues */}
				<div className='border-t border-void-border-2 pt-3 mt-3'>
					<div className='flex items-center justify-between w-full text-sm text-void-fg-2'>
						<button onClick={() => setSubTasksOpen(o => !o)} className='flex items-center gap-1.5'>
							{subTasksOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
							Sub-issues
							{subtasks.length > 0 && <span className='text-void-fg-3'>({subtasks.length})</span>}
						</button>
						<button
							onClick={() => { setAddingSubtask(v => !v); setAddingRelation(false) }}
							className='p-1 rounded hover:bg-void-bg-1 text-void-fg-3 hover:text-void-fg-1'
							title='Add sub-issue'
						>
							{addingSubtask ? <X size={15} /> : <Plus size={15} />}
						</button>
					</div>
					{subTasksOpen && (
						<div className='mt-2 pl-5 flex flex-col gap-1.5'>
							{addingSubtask && (
								<form
									className='flex items-center gap-2 mb-1'
									onSubmit={e => {
										e.preventDefault()
										const title = subtaskTitle.trim()
										if (!title) return
										void runMutation('subtask', async () => {
											await kaneoApi.createSubtask(task.id, title)
											setSubtaskTitle('')
											setAddingSubtask(false)
										})
									}}
								>
									<input
										autoFocus
										value={subtaskTitle}
										onChange={e => setSubtaskTitle(e.target.value)}
										placeholder='Sub-issue title…'
										className='flex-1 min-w-0 bg-void-bg-1 rounded px-2 py-1.5 text-xs text-void-fg-1 outline-none'
									/>
									<button
										type='submit'
										disabled={busy === 'subtask' || !subtaskTitle.trim()}
										className='text-xs px-2.5 py-1.5 rounded bg-void-bg-1 text-void-fg-1 hover:bg-void-bg-1-alt disabled:opacity-50'
									>
										{busy === 'subtask' ? '…' : 'Add'}
									</button>
								</form>
							)}
							{subtasks.length === 0 && !addingSubtask && (
								<div className='text-xs text-void-fg-3'>No sub-issues yet</div>
							)}
							{subtasks.map(s => (
								<button
									key={s.id}
									onClick={() => openIssue(s.id, s.title)}
									className='flex items-center gap-2 text-xs text-left text-void-fg-2 hover:text-void-fg-1 py-0.5'
								>
									<span className='text-void-fg-3 shrink-0'>
										{projectCode(task.projectName)}-{s.number ?? '?'}
									</span>
									<span className='truncate'>{s.title}</span>
									<span className='text-void-fg-4 shrink-0 ml-auto'>{s.columnName ?? s.status ?? ''}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Relations */}
				<div className='border-t border-void-border-2 pt-3 mt-3'>
					<div className='flex items-center justify-between w-full text-sm text-void-fg-2'>
						<button onClick={() => setRelationsOpen(o => !o)} className='flex items-center gap-1.5'>
							{relationsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
							Relations
							{relations.length > 0 && <span className='text-void-fg-3'>({relations.length})</span>}
						</button>
						<button
							onClick={() => { setAddingRelation(v => !v); setAddingSubtask(false) }}
							className='p-1 rounded hover:bg-void-bg-1 text-void-fg-3 hover:text-void-fg-1'
							title='Add relation'
						>
							{addingRelation ? <X size={15} /> : <Plus size={15} />}
						</button>
					</div>
					{relationsOpen && (
						<div className='mt-2 pl-5 flex flex-col gap-1.5'>
							{addingRelation && (
								<form
									className='flex flex-wrap items-center gap-2 mb-1'
									onSubmit={e => {
										e.preventDefault()
										if (!relationTargetId) return
										void runMutation('relation', async () => {
											await kaneoApi.createRelation(task.id, relationTargetId, relationType)
											setRelationTargetId('')
											setAddingRelation(false)
										})
									}}
								>
									<select
										value={relationType}
										onChange={e => setRelationType(e.target.value as 'blocks' | 'related')}
										className='bg-void-bg-1 rounded px-2 py-1.5 text-xs text-void-fg-1 outline-none'
									>
										<option value='related'>related</option>
										<option value='blocks'>blocks</option>
									</select>
									<select
										value={relationTargetId}
										onChange={e => setRelationTargetId(e.target.value)}
										className='flex-1 min-w-[10rem] bg-void-bg-1 rounded px-2 py-1.5 text-xs text-void-fg-1 outline-none'
									>
										<option value=''>Select issue…</option>
										{relationCandidates.map(i => (
											<option key={i.id} value={i.id}>
												{projectCode(task.projectName)}-{i.number ?? '?'} — {i.title}
											</option>
										))}
									</select>
									<button
										type='submit'
										disabled={busy === 'relation' || !relationTargetId}
										className='text-xs px-2.5 py-1.5 rounded bg-void-bg-1 text-void-fg-1 hover:bg-void-bg-1-alt disabled:opacity-50'
									>
										{busy === 'relation' ? '…' : 'Add'}
									</button>
									{relationCandidates.length === 0 && (
										<span className='text-[11px] text-void-fg-3 w-full'>No other assigned issues in this project to link.</span>
									)}
								</form>
							)}
							{relations.length === 0 && !addingRelation && (
								<div className='text-xs text-void-fg-3'>No related issues</div>
							)}
							{relations.map(r => (
								<button
									key={r.id}
									onClick={() => openIssue(r.relatedTaskId, r.relatedTaskTitle ?? r.relatedTaskId)}
									className='flex items-center gap-2 text-xs text-left text-void-fg-2 hover:text-void-fg-1 py-0.5'
								>
									<span className='text-void-fg-3 shrink-0 capitalize'>{r.relationType}</span>
									<span className='text-void-fg-4 shrink-0'>
										{projectCode(task.projectName)}-{r.relatedTaskNumber ?? '?'}
									</span>
									<span className='truncate'>{r.relatedTaskTitle ?? r.relatedTaskId}</span>
									{r.relatedColumnName && <span className='text-void-fg-4 shrink-0 ml-auto'>{r.relatedColumnName}</span>}
								</button>
							))}
						</div>
					)}
				</div>

				<div className='border-t border-void-border-2 mt-6 pt-6'>
					<div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
						<h3 className='text-sm font-semibold text-void-fg-1'>Comments</h3>
						<div className='flex items-center gap-2 text-xs text-void-fg-3'>
							<span className={`w-1.5 h-1.5 rounded-full inline-block ${agentOnline ? 'bg-emerald-500' : 'bg-void-fg-4'}`} />
							{agentOnline ? 'Agent online' : 'Agent offline'}
							<button
								disabled={triggering}
								onClick={async () => {
									setTriggering(true)
									try {
										await commandService.executeCommand(VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID, task.id)
									} finally {
										setTriggering(false)
									}
								}}
								className='bg-void-bg-1 rounded px-3 py-1.5 text-void-fg-1 hover:bg-void-bg-1-alt disabled:opacity-50'
							>
								{triggering ? 'Starting…' : 'Trigger Agent'}
							</button>
						</div>
					</div>

					<form
						className='relative'
						onSubmit={e => {
							e.preventDefault()
							const content = commentDraft.trim()
							if (!content) return
							void runMutation('comment', async () => {
								await kaneoApi.createComment(task.id, content)
								setCommentDraft('')
							})
						}}
					>
						<textarea
							value={commentDraft}
							onChange={e => setCommentDraft(e.target.value)}
							placeholder='Leave a comment...'
							rows={3}
							className='w-full bg-void-bg-1 rounded-lg p-3 pr-10 text-sm text-void-fg-1 placeholder:text-void-fg-3 outline-none resize-none'
							onKeyDown={e => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
									e.currentTarget.form?.requestSubmit()
								}
							}}
						/>
						<button
							type='submit'
							disabled={busy === 'comment' || !commentDraft.trim()}
							className='absolute bottom-3 right-3 p-1.5 rounded-full bg-void-bg-2 text-void-fg-3 hover:text-void-fg-1 disabled:opacity-40'
						>
							<ArrowUp size={14} />
						</button>
					</form>

					<div className='flex flex-col mt-6'>
						{comments.length === 0 && <div className='text-xs text-void-fg-3'>No comments yet</div>}
						{comments.map((c, i) => (
							<div key={c.id} className='flex items-start gap-3 pb-5 relative'>
								{i < comments.length - 1 && <div className='absolute left-[13px] top-7 bottom-0 w-px bg-void-border-2' />}
								<div className='w-[26px] h-[26px] rounded-full bg-pink-500/80 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 z-10'>
									{(c.authorName || '?').slice(0, 2).toUpperCase()}
								</div>
								<div className='text-sm text-void-fg-2 pt-1'>
									<span className='font-medium text-void-fg-1'>{c.authorName}</span>{' '}
									<span className='text-void-fg-3 text-xs'>{fromNow(c.createdAtMs, true)}</span>
									<div className='whitespace-pre-wrap'>{c.content}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</main>

			{/* Right sidebar */}
			<aside className='md:w-72 w-full p-6 shrink-0 flex flex-col gap-4'>
				<SidebarRow icon={columnIcon({ isStarted: task.columnIsStarted, isFinal: task.columnIsFinal }, 15)} label={task.columnName ?? 'No status'} bold />
				<SidebarRow icon={<Flag size={15} className='text-void-fg-3' />} label={task.priority ? task.priority : 'No priority'} />
				{task.dueDate ? <SidebarRow icon={<CalendarClock size={15} className='text-void-fg-3' />} label={new Date(task.dueDate).toLocaleDateString()} /> : null}

				{/* Labels */}
				<div className='mt-2'>
					<div className='text-xs text-void-fg-3 mb-2'>Labels</div>
					<div className='flex flex-wrap gap-1.5'>
						{task.labels.map(l => (
							<span key={l.name} className='text-xs rounded-full px-2 py-0.5' style={{ backgroundColor: l.color, color: '#fff' }}>{l.name}</span>
						))}
						{task.labels.length === 0 && <span className='text-xs text-void-fg-3'>No labels</span>}
					</div>
				</div>
			</aside>
		</div>
	</div>
}

const SidebarRow = ({ icon, label, bold, muted }: { icon: React.ReactNode, label: string, bold?: boolean, muted?: boolean }) => {
	return <div className='flex items-center gap-2.5 text-sm'>
		{icon}
		<span className={muted ? 'text-void-fg-3' : bold ? 'text-void-fg-1 font-medium' : 'text-void-fg-2'}>{label}</span>
	</div>
}
