/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ProjectsSidebar } from './ProjectsSidebar.js'
import { TasksBoard } from './TasksBoard.js'
import { KaneoSignIn } from './KaneoSignIn.js'
import { Issue, Project } from './kaneoTypes.js'
import { useAccessor, useIsDark, useKaneoAuthState } from '../util/services.js'

// Layout mirrors Settings.tsx exactly: a scrollable root (height:100%, overflow:auto, no
// display:flex on it) containing a separate plain flex-row child with natural/min-height
// sizing. Combining display:flex + height:100% + overflow:auto on the SAME element breaks
// flex-1 width distribution in this pane's DOM context — see VOID_TASKS_FEATURE_NOTES.md.
export const Tasks = () => {
	const isDark = useIsDark()
	const accessor = useAccessor()
	const kaneoAuth = accessor.get('IKaneoAuthService')
	const kaneoApi = accessor.get('IKaneoApiService')
	const { state: authState, ready: authReady } = useKaneoAuthState()

	const loggedIn = authReady ? authState.loggedIn : undefined
	const baseUrl = authState.baseUrl || 'http://localhost:1337'

	const [projects, setProjects] = useState<Project[]>([])
	const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
	const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
	const [allIssues, setAllIssues] = useState<Issue[]>([])
	const [loadError, setLoadError] = useState('')

	useEffect(() => {
		if (!authReady || authState.loggedIn) {
			return
		}
		setProjects([])
		setAllIssues([])
		setSelectedProjectId(undefined)
		setLoadError('')
	}, [authReady, authState.loggedIn])

	const onSignedIn = useCallback(() => {
		// pollDeviceToken already fires onDidChangeAuthState; this is a safety refresh
		void kaneoAuth.getAuthState()
	}, [kaneoAuth])

	const loadTasks = useCallback(async () => {
		setLoadError('')
		try {
			const [kaneoProjects, kaneoTasks] = await Promise.all([
				kaneoApi.getMyProjects(),
				kaneoApi.getMyTasks(),
			])
			const mappedProjects: Project[] = kaneoProjects.map(p => ({ id: p.id, name: p.name, updatedAtMs: p.updatedAtMs, columns: p.columns }))
			const mappedIssues: Issue[] = kaneoTasks.map(t => ({
				id: t.id,
				projectId: t.projectId,
				title: t.title,
				columnId: t.columnId,
				columnName: t.columnName,
				columnIsStarted: t.columnIsStarted,
				columnIsFinal: t.columnIsFinal,
				updatedAtMs: t.updatedAtMs,
			}))
			setProjects(mappedProjects)
			setAllIssues(mappedIssues)
			setSelectedProjectId(prev => prev && mappedProjects.some(p => p.id === prev) ? prev : mappedProjects[0]?.id)
		} catch (e) {
			setLoadError(String(e))
		}
	}, [kaneoApi])

	useEffect(() => {
		if (loggedIn) loadTasks()
	}, [loggedIn, loadTasks])

	const selectedProject = useMemo(
		() => projects.find(p => p.id === selectedProjectId),
		[projects, selectedProjectId]
	)

	const projectIssues = useMemo(
		() => allIssues.filter(i => i.projectId === selectedProjectId),
		[allIssues, selectedProjectId]
	)

	const issueCounts = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const issue of allIssues) counts[issue.projectId] = (counts[issue.projectId] ?? 0) + 1
		return counts
	}, [allIssues])

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
			<div className='p-8 text-void-fg-3 text-sm'>Yükleniyor...</div>
		) : loadError ? (
			<div className='p-8 text-sm text-red-400'>{loadError}</div>
		) : (
			<div className='flex flex-col md:flex-row w-full bg-void-bg-2 text-void-fg-1' style={{ minHeight: '100%' }}>
				<ProjectsSidebar
					projects={projects}
					selectedProjectId={selectedProjectId}
					onSelectProject={setSelectedProjectId}
					issueCounts={issueCounts}
				/>
				<TasksBoard
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
