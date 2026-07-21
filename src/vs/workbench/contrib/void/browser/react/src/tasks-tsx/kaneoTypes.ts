/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Replaces mockData.ts - real data now comes from IKaneoApiService (see Tasks.tsx /
// TaskDetail.tsx). Kept as plain local type declarations (not imported from
// common/kaneoApiService.js) so this React bundle never pulls in that file's
// ProxyChannel/DI imports - same reasoning as commandIds.ts's literal command-id
// constants.
//
// Statuses are each project's own real columns (position-ordered), not a fixed/dummy
// 3-value union - different projects can define different columns.

export interface Column {
	id: string
	name: string
	slug: string
	position: number
	isStarted: boolean
	isFinal: boolean
}

export interface Project {
	id: string
	name: string
	updatedAtMs: number
	columns: Column[]
}

export interface Issue {
	id: string
	projectId: string
	title: string
	columnId: string | null
	columnName: string | null
	columnIsStarted: boolean
	columnIsFinal: boolean
	updatedAtMs: number
}

export interface TaskLabel {
	name: string
	color: string
}

export interface TaskComment {
	id: string
	content: string
	authorName: string
	createdAtMs: number
}

export interface TaskRelation {
	id: string
	relationType: string
	relatedTaskId: string
}

export interface TaskDetailData {
	id: string
	number: number | null
	projectId: string
	projectName: string
	title: string
	description: string | null
	columnId: string | null
	columnName: string | null
	columnIsStarted: boolean
	columnIsFinal: boolean
	priority: string | null
	dueDate: number | null
	labels: TaskLabel[]
	comments: TaskComment[]
	relations: TaskRelation[]
}
