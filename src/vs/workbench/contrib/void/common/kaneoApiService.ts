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
	/** Lucide icon name from Kaneo project settings (e.g. "Layout"). */
	icon: string;
	iconColor: string;
	updatedAtMs: number;
	/** Current user's local filesystem path for this project (from Kaneo). */
	localPath: string | null;
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
	relatedTaskTitle: string;
	relatedTaskNumber: number | null;
	relatedColumnName: string | null;
	direction: 'outgoing' | 'incoming';
}

export interface KaneoTaskSubtask {
	id: string;
	relationId: string;
	title: string;
	number: number | null;
	status: string | null;
	columnName: string | null;
}

export interface KaneoTaskAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	kind: string;
	surface: string;
	createdAtMs: number;
	url: string;
}

export interface KaneoDownloadedAttachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	localPath: string;
}

export interface KaneoTaskDetail extends KaneoTaskSummary {
	description: string | null;
	status?: string | null;
	labels: KaneoTaskLabel[];
	comments: KaneoTaskComment[];
	subtasks: KaneoTaskSubtask[];
	relations: KaneoTaskRelation[];
	attachments: KaneoTaskAttachment[];
	/** Current user's local filesystem path for the task's project (from Kaneo). */
	localPath: string | null;
}

export type KaneoRelationType = 'blocks' | 'related' | 'subtask';

export interface IKaneoApiService {
	readonly _serviceBrand: undefined;
	getMyProjects(): Promise<KaneoProject[]>;
	getMyTasks(): Promise<KaneoTaskSummary[]>;
	getTaskDetail(taskId: string): Promise<KaneoTaskDetail | null>;
	createComment(taskId: string, content: string): Promise<void>;
	createSubtask(parentTaskId: string, title: string): Promise<void>;
	createRelation(sourceTaskId: string, targetTaskId: string, relationType: KaneoRelationType): Promise<void>;
	/** Download task attachments to a temp folder for agent use. */
	downloadTaskAttachments(taskId: string): Promise<KaneoDownloadedAttachment[]>;
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
	createComment: IKaneoApiService['createComment'] = async (taskId, content) => this.kaneoApiService.createComment(taskId, content);
	createSubtask: IKaneoApiService['createSubtask'] = async (parentTaskId, title) => this.kaneoApiService.createSubtask(parentTaskId, title);
	createRelation: IKaneoApiService['createRelation'] = async (sourceTaskId, targetTaskId, relationType) => this.kaneoApiService.createRelation(sourceTaskId, targetTaskId, relationType);
	downloadTaskAttachments: IKaneoApiService['downloadTaskAttachments'] = async (taskId) => this.kaneoApiService.downloadTaskAttachments(taskId);
}

registerSingleton(IKaneoApiService, KaneoApiService, InstantiationType.Eager);
