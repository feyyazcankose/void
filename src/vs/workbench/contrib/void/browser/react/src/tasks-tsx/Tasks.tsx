/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TasksBoard } from './TasksBoard.js'
import { KaneoSignIn } from './KaneoSignIn.js'
import { Issue, Project } from './kaneoTypes.js'
import { useAccessor, useIsDark, useKaneoAuthState } from '../util/services.js'

/** Light poll while Tasks pane is open — 2 small GETs per tick; skip when tab hidden. */
const TASKS_REFRESH_MS = 20_000

// Layout mirrors Settings.tsx exactly: a scrollable root (height:100%, overflow:auto, no
// display:flex on it) containing a separate plain flex-row child with natural/min-height
// sizing. Combining display:flex + height:100% + overflow:auto on the SAME element breaks
// flex-1 width distribution in this pane's DOM context — see VOID_TASKS_FEATURE_NOTES.md.
export const Tasks = () => {
	const isDark = useIsDark()
	const accessor = useAccessor()
	const kaneoAuth = accessor.get('IKaneoAuthService')
	const kaneoApi = accessor.get('IKaneoApiService')
	const kaneoWs = accessor.get('IKaneoWsService')
	const { state: authState, ready: authReady } = useKaneoAuthState()

	const loggedIn = authReady ? authState.loggedIn : undefined
	const baseUrl = authState.baseUrl || 'http://localhost:1337'

	const [projects, setProjects] = useState<Project[]>([])
	const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
	const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
	const [allIssues, setAllIssues] = useState<Issue[]>([])
	const [loadError, setLoadError] = useState('')
	const hasLoadedOnce = useRef(false)
	const loadInFlight = useRef(false)

	useEffect(() => {
		if (!authReady || authState.loggedIn) {
			return
		}
		setProjects([])
		setAllIssues([])
		setSelectedProjectId(undefined)
		setLoadError('')
		hasLoadedOnce.current = false
	}, [authReady, authState.loggedIn])

	const onSignedIn = useCallback(() => {
		// pollDeviceToken already fires onDidChangeAuthState; this is a safety refresh
		void kaneoAuth.getAuthState()
	}, [kaneoAuth])

	const loadTasks = useCallback(async (opts?: { silent?: boolean }) => {
		if (loadInFlight.current) return
		loadInFlight.current = true
		const silent = opts?.silent === true
		if (!silent) setLoadError('')
		try {
			const [kaneoProjects, kaneoTasks] = await Promise.all([
				kaneoApi.getMyProjects(),
				kaneoApi.getMyTasks(),
			])
			const mappedProjects: Project[] = kaneoProjects.map(p => ({
				id: p.id,
				name: p.name,
				updatedAtMs: p.updatedAtMs,
				localPath: p.localPath ?? null,
				icon: p.icon || 'Layout',
				iconColor: p.iconColor || '#64748b',
				columns: p.columns,
			}))
			const mappedIssues: Issue[] = kaneoTasks.map(t => ({
				id: t.id,
				projectId: t.projectId,
				title: t.title,
				number: t.number,
				columnId: t.columnId,
				columnName: t.columnName,
				columnIsStarted: t.columnIsStarted,
				columnIsFinal: t.columnIsFinal,
				updatedAtMs: t.updatedAtMs,
			}))
			setProjects(mappedProjects)
			setAllIssues(mappedIssues)
			setSelectedProjectId(prev => prev && mappedProjects.some(p => p.id === prev) ? prev : mappedProjects[0]?.id)
			setLoadError('')
			hasLoadedOnce.current = true
		} catch (e) {
			// Background refresh: keep last good board; only surface errors on first load.
			if (!silent || !hasLoadedOnce.current) {
				setLoadError(String(e))
			}
		} finally {
			loadInFlight.current = false
		}
	}, [kaneoApi])

	useEffect(() => {
		if (loggedIn) void loadTasks()
	}, [loggedIn, loadTasks])

	// Poll + refresh when the desktop window becomes visible again.
	useEffect(() => {
		if (!loggedIn) return

		const tick = () => {
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
			void loadTasks({ silent: true })
		}

		const intervalId = window.setInterval(tick, TASKS_REFRESH_MS)
		const onVisibility = () => {
			if (document.visibilityState === 'visible') tick()
		}
		document.addEventListener('visibilitychange', onVisibility)

		return () => {
			window.clearInterval(intervalId)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [loggedIn, loadTasks])

	// Status-change WS events (agent trigger) — refresh board immediately so columns stay in sync.
	useEffect(() => {
		if (!loggedIn) return
		const sub = kaneoWs.onTaskStatusChanged(() => {
			void loadTasks({ silent: true })
		})
		return () => sub.dispose()
	}, [loggedIn, kaneoWs, loadTasks])

	const selectedProject = useMemo(
		() => projects.find(p => p.id === selectedProjectId),
		[projects, selectedProjectId]
	)

	const projectIssues = useMemo(
		() => allIssues.filter(i => i.projectId === selectedProjectId),
		[allIssues, selectedProjectId]
	)

	// local-only for now — persisting a drag&drop column change back to Kaneo is a later
	// phase (see mause-plans/01-mause-desktop-plans.md gap list)
	const onChangeColumn = (issueId: string, columnId: string | null) => {
		const column = selectedProject?.columns.find(c => c.id === columnId)
		setAllIssues(prev => prev.map(i => i.id === issueId ? {
			...i,
			columnId,
			columnName: column?.name ?? null,
			columnIsStarted: column?.isStarted ?? false,
			columnIsFinal: column?.isFinal ?? false,
			updatedAtMs: Date.now(),
		} : i))
	}

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ height: '100%', width: '100%', overflow: 'auto' }}
	>
		{loggedIn === false ? (
			<KaneoSignIn initialBaseUrl={baseUrl} onSignedIn={onSignedIn} />
		) : loggedIn === undefined ? (
			<div className='p-8 text-void-fg-3 text-sm'>Loading...</div>
		) : loadError ? (
			<div className='p-8 text-sm text-red-400'>{loadError}</div>
		) : (
			<div className='flex flex-col w-full bg-void-bg-2 text-void-fg-1' style={{ minHeight: '100%' }}>
				<TasksBoard
					projects={projects}
					selectedProjectId={selectedProjectId}
					onSelectProject={setSelectedProjectId}
					columns={selectedProject?.columns ?? []}
					issues={projectIssues}
					viewMode={viewMode}
					onChangeViewMode={setViewMode}
					onChangeColumn={onChangeColumn}
				/>
			</div>
		)}
	</div>
}
