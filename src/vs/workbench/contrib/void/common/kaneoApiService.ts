/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

// Shapes mirror kaneo-task's /api/my-work/* responses - see
// mause-task-managment-web/kaneo-task/apps/api/src/my-work/controllers/*.ts
// Statuses are each project's own real columns (position-ordered), not a bucketed/dummy
// 3-value union - different projects can have different columns.

export interface KaneoColumn {
	id: string;
	name: string;
	slug: string;
	position: number;
	isStarted: boolean;
	isFinal: boolean;
}

export interface KaneoProject {
	id: string;
	name: string;
	slug: string;
	workspaceId: string;
	updatedAtMs: number;
	columns: KaneoColumn[];
}

export interface KaneoTaskSummary {
	id: string;
	number: number | null;
	projectId: string;
	projectName: string;
	title: string;
	columnId: string | null;
	columnName: string | null;
	columnIsStarted: boolean;
	columnIsFinal: boolean;
	priority: string | null;
	dueDate: number | null;
	updatedAtMs: number;
}

export interface KaneoTaskLabel {
	name: string;
	color: string;
}

export interface KaneoTaskComment {
	id: string;
	content: string;
	authorName: string;
	createdAtMs: number;
}

export interface KaneoTaskRelation {
	id: string;
	relationType: string;
	relatedTaskId: string;
}

export interface KaneoTaskDetail extends KaneoTaskSummary {
	description: string | null;
	labels: KaneoTaskLabel[];
	comments: KaneoTaskComment[];
	relations: KaneoTaskRelation[];
}

export interface IKaneoApiService {
	readonly _serviceBrand: undefined;
	getMyProjects(): Promise<KaneoProject[]>;
	getMyTasks(): Promise<KaneoTaskSummary[]>;
	getTaskDetail(taskId: string): Promise<KaneoTaskDetail | null>;
}

export const IKaneoApiService = createDecorator<IKaneoApiService>('KaneoApiService');

// implemented by calling channel - mirrors voidUpdateService.ts
class KaneoApiService implements IKaneoApiService {

	readonly _serviceBrand: undefined;
	private readonly kaneoApiService: IKaneoApiService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		this.kaneoApiService = ProxyChannel.toService<IKaneoApiService>(mainProcessService.getChannel('kaneo-api'));
	}

	getMyProjects: IKaneoApiService['getMyProjects'] = async () => this.kaneoApiService.getMyProjects();
	getMyTasks: IKaneoApiService['getMyTasks'] = async () => this.kaneoApiService.getMyTasks();
	getTaskDetail: IKaneoApiService['getTaskDetail'] = async (taskId) => this.kaneoApiService.getTaskDetail(taskId);
}

registerSingleton(IKaneoApiService, KaneoApiService, InstantiationType.Eager);
