/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css'
import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Paperclip, ArrowUp, Flag, CalendarClock } from 'lucide-react'
import { fromNow } from '../../../../../../../base/common/date.js'
import { columnIcon, projectCode } from '../tasks-tsx/statusMeta.js'
import { TaskDetailData } from '../tasks-tsx/kaneoTypes.js'
import { useIsDark, useAccessor } from '../util/services.js'
import { VOID_TOGGLE_TASKS_ACTION_ID } from '../tasks-tsx/commandIds.js'

// Real data via IKaneoApiService.getTaskDetail (see mause-task-managment-web/kaneo-task's
// /api/my-work/tasks/:id). Sub-tasks/relations/comment-box/Trigger-Agent are still mock -
// those are later-phase work (see mause-plans/01-mause-desktop-plans.md gap list); this
// pane only replaces the data source for what Milestone A covers (real task viewing).
export const TaskDetail = ({ issueId }: { issueId: string }) => {
	const isDark = useIsDark()
	const accessor = useAccessor()
	const kaneoApi = accessor.get('IKaneoApiService')
	const openTasksPane = () => accessor.get('ICommandService').executeCommand(VOID_TOGGLE_TASKS_ACTION_ID)

	const [task, setTask] = useState<TaskDetailData | null | undefined>(undefined) // undefined = loading
	const [subTasksOpen, setSubTasksOpen] = useState(true)
	const [relationsOpen, setRelationsOpen] = useState(true)

	useEffect(() => {
		let cancelled = false
		setTask(undefined)
		kaneoApi.getTaskDetail(issueId).then(t => { if (!cancelled) setTask(t) })
		return () => { cancelled = true }
	}, [kaneoApi, issueId])

	if (task === undefined) {
		return <div className={`@@void-scope ${isDark ? 'dark' : ''} p-8 text-void-fg-3 text-sm`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			Yükleniyor...
		</div>
	}

	if (!task) {
		return <div className={`@@void-scope ${isDark ? 'dark' : ''} p-8 text-void-fg-3 text-sm`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			Bu talep artık mevcut değil.
		</div>
	}

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ height: '100%', width: '100%', overflow: 'auto' }}
	>
		<div className='flex flex-col md:flex-row w-full bg-void-bg-2 text-void-fg-1' style={{ minHeight: '100%' }}>

			{/* Main content */}
			<main className='flex-1 min-w-0 p-8'>
				<div className='flex items-center gap-1.5 text-xs text-void-fg-3 mb-4'>
					<button onClick={openTasksPane} className='hover:text-void-fg-1'>Projeler</button>
					<ChevronRight size={12} />
					<button onClick={openTasksPane} className='hover:text-void-fg-1'>{task.projectName}</button>
					<ChevronRight size={12} />
					<span className='text-void-fg-2 font-medium'>{projectCode(task.projectName)}-{task.number ?? '?'}</span>
				</div>
				<h1 className='text-3xl font-bold text-void-fg-1 mb-5 leading-tight'>{task.title}</h1>

				<p className='text-sm text-void-fg-2 leading-relaxed whitespace-pre-wrap'>
					{task.description || 'Açıklama yok.'}
				</p>

				<div className='flex items-center gap-2 mt-4 mb-2 text-void-fg-3'>
					<button className='p-2 rounded-full hover:bg-void-bg-1'><Paperclip size={15} /></button>
				</div>

				{/* Sub-tasks (not wired to real data yet) */}
				<div className='border-t border-void-border-2 pt-3 mt-4'>
					<button onClick={() => setSubTasksOpen(o => !o)} className='flex items-center justify-between w-full text-sm text-void-fg-2'>
						<span className='flex items-center gap-1.5'>
							{subTasksOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
							Alt talepler
						</span>
						<Plus size={15} className='text-void-fg-3' />
					</button>
					{subTasksOpen && <div className='text-xs text-void-fg-3 mt-2 pl-5'>Henüz alt talep yok</div>}
				</div>

				{/* Relations */}
				<div className='border-t border-void-border-2 pt-3 mt-3'>
					<button onClick={() => setRelationsOpen(o => !o)} className='flex items-center justify-between w-full text-sm text-void-fg-2'>
						<span className='flex items-center gap-1.5'>
							{relationsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
							İlişkiler
						</span>
						<Plus size={15} className='text-void-fg-3' />
					</button>
					{relationsOpen && (
						task.relations.length === 0
							? <div className='text-xs text-void-fg-3 mt-2 pl-5'>İlişkili talep yok</div>
							: <div className='text-xs text-void-fg-3 mt-2 pl-5 flex flex-col gap-1'>
								{task.relations.map(r => <div key={r.id}>{r.relationType}: {r.relatedTaskId}</div>)}
							</div>
					)}
				</div>

				<div className='border-t border-void-border-2 mt-6 pt-6'>
					<div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
						<h3 className='text-sm font-semibold text-void-fg-1'>Yorumlar</h3>
						{/* mock-only: agent trigger isn't wired up yet (later phase) */}
						<div className='flex items-center gap-2 text-xs text-void-fg-3'>
							<span className='w-1.5 h-1.5 rounded-full bg-void-fg-4 inline-block' /> Agent offline
							<select className='bg-void-bg-1 rounded px-2 py-1 text-void-fg-2 border-none outline-none'>
								<option>direct</option>
							</select>
							<button className='bg-void-bg-1 rounded px-3 py-1.5 text-void-fg-1 hover:bg-void-bg-1-alt'>Trigger Agent</button>
						</div>
					</div>

					{/* mock-only: comment submission isn't wired up yet (later phase) */}
					<div className='relative'>
						<textarea
							placeholder='Yorum bırakın...'
							rows={3}
							className='w-full bg-void-bg-1 rounded-lg p-3 pr-10 text-sm text-void-fg-1 placeholder:text-void-fg-3 outline-none resize-none'
						/>
						<button className='absolute bottom-3 right-3 p-1.5 rounded-full bg-void-bg-2 text-void-fg-3 hover:text-void-fg-1'>
							<ArrowUp size={14} />
						</button>
					</div>

					<div className='flex flex-col mt-6'>
						{task.comments.length === 0 && <div className='text-xs text-void-fg-3'>Henüz yorum yok</div>}
						{task.comments.map((c, i) => (
							<div key={c.id} className='flex items-start gap-3 pb-5 relative'>
								{i < task.comments.length - 1 && <div className='absolute left-[13px] top-7 bottom-0 w-px bg-void-border-2' />}
								<div className='w-[26px] h-[26px] rounded-full bg-pink-500/80 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 z-10'>
									{c.authorName.slice(0, 2).toUpperCase()}
								</div>
								<div className='text-sm text-void-fg-2 pt-1'>
									<span className='font-medium text-void-fg-1'>{c.authorName}</span>{' '}
									<span className='text-void-fg-3 text-xs'>{fromNow(c.createdAtMs, true)}</span>
									<div>{c.content}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</main>

			{/* Right sidebar */}
			<aside className='md:w-72 w-full p-6 shrink-0 flex flex-col gap-4'>
				<SidebarRow icon={columnIcon({ isStarted: task.columnIsStarted, isFinal: task.columnIsFinal }, 15)} label={task.columnName ?? 'Durum yok'} bold />
				<SidebarRow icon={<Flag size={15} className='text-void-fg-3' />} label={task.priority ? task.priority : 'Öncelik yok'} />
				{task.dueDate ? <SidebarRow icon={<CalendarClock size={15} className='text-void-fg-3' />} label={new Date(task.dueDate).toLocaleDateString()} /> : null}

				{/* Labels */}
				<div className='mt-2'>
					<div className='text-xs text-void-fg-3 mb-2'>Etiketler</div>
					<div className='flex flex-wrap gap-1.5'>
						{task.labels.map(l => (
							<span key={l.name} className='text-xs rounded-full px-2 py-0.5' style={{ backgroundColor: l.color, color: '#fff' }}>{l.name}</span>
						))}
						<button className='p-1.5 rounded-full bg-void-bg-1 text-void-fg-3 hover:text-void-fg-1'>
							<Plus size={14} />
						</button>
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
