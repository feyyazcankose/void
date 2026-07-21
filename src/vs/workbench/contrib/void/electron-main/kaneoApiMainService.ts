/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEncryptionMainService } from '../../../../platform/encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import {
	IKaneoApiService,
	KaneoDownloadedAttachment,
	KaneoProject,
	KaneoRelationType,
	KaneoTaskDetail,
	KaneoTaskSummary,
} from '../common/kaneoApiService.js';
import { getStoredKaneoAccessToken, getStoredKaneoBaseUrl } from './kaneoTokenStore.js';

// Reads the token/base-url from the same storage kaneoAuthMainService.ts writes to
// (kaneoTokenStore.ts) rather than depending on that service directly.
export class KaneoApiMainService extends Disposable implements IKaneoApiService {
	_serviceBrand: undefined;

	constructor(
		@IEncryptionMainService private readonly _encryptionService: IEncryptionMainService,
		@IApplicationStorageMainService private readonly _appStorage: IApplicationStorageMainService,
	) {
		super();
	}

	private async _creds(): Promise<{ baseUrl: string; token: string }> {
		await this._appStorage.whenReady;
		const baseUrl = getStoredKaneoBaseUrl(this._appStorage);
		const token = await getStoredKaneoAccessToken(this._encryptionService, this._appStorage);
		if (!token) throw new Error('Not signed in to Task Management.');
		return { baseUrl, token };
	}

	private async _authedFetch(pathSuffix: string, init?: RequestInit): Promise<any> {
		const { baseUrl, token } = await this._creds();
		const res = await fetch(`${baseUrl}${pathSuffix}`, {
			...init,
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'Mause-Desktop/1.0',
				...(init?.body ? { 'Content-Type': 'application/json' } : {}),
				...(init?.headers ?? {}),
			},
		});
		if (res.status === 404) return null;
		if (!res.ok) {
			throw new Error(`Kaneo request failed (${res.status}): ${await res.text().catch(() => '')}`);
		}
		if (res.status === 204) return null;
		const text = await res.text();
		if (!text) return null;
		return JSON.parse(text);
	}

	async getMyProjects(): Promise<KaneoProject[]> {
		return (await this._authedFetch('/api/my-work/projects')) ?? [];
	}

	async getMyTasks(): Promise<KaneoTaskSummary[]> {
		return (await this._authedFetch('/api/my-work/tasks')) ?? [];
	}

	async getTaskDetail(taskId: string): Promise<KaneoTaskDetail | null> {
		const detail = await this._authedFetch(`/api/my-work/tasks/${encodeURIComponent(taskId)}`);
		if (!detail) return null;
		// Back-compat if an older API is still running briefly.
		return {
			...detail,
			subtasks: detail.subtasks ?? [],
			attachments: detail.attachments ?? [],
			relations: (detail.relations ?? []).map((r: any) => ({
				id: r.id,
				relationType: r.relationType,
				relatedTaskId: r.relatedTaskId,
				relatedTaskTitle: r.relatedTaskTitle ?? r.relatedTaskId,
				relatedTaskNumber: r.relatedTaskNumber ?? null,
				relatedColumnName: r.relatedColumnName ?? null,
				direction: r.direction ?? 'outgoing',
			})),
		};
	}

	async createComment(taskId: string, content: string): Promise<void> {
		await this._authedFetch(`/api/comment/${encodeURIComponent(taskId)}`, {
			method: 'POST',
			body: JSON.stringify({ content }),
		});
	}

	async createSubtask(parentTaskId: string, title: string): Promise<void> {
		const parent = await this.getTaskDetail(parentTaskId);
		if (!parent) throw new Error('Parent task not found.');
		const projects = await this.getMyProjects();
		const project = projects.find(p => p.id === parent.projectId);
		const status = project?.columns.sort((a, b) => a.position - b.position)[0]?.slug
			?? parent.status
			?? 'to-do';

		const created = await this._authedFetch(`/api/task/${encodeURIComponent(parent.projectId)}`, {
			method: 'POST',
			body: JSON.stringify({
				title: title.trim(),
				description: '',
				priority: 'no-priority',
				status,
			}),
		});
		if (!created?.id) throw new Error('Failed to create subtask.');

		await this._authedFetch('/api/task-relation', {
			method: 'POST',
			body: JSON.stringify({
				sourceTaskId: parentTaskId,
				targetTaskId: created.id,
				relationType: 'subtask',
			}),
		});
	}

	async createRelation(sourceTaskId: string, targetTaskId: string, relationType: KaneoRelationType): Promise<void> {
		await this._authedFetch('/api/task-relation', {
			method: 'POST',
			body: JSON.stringify({ sourceTaskId, targetTaskId, relationType }),
		});
	}

	async downloadTaskAttachments(taskId: string): Promise<KaneoDownloadedAttachment[]> {
		const detail = await this.getTaskDetail(taskId);
		if (!detail?.attachments?.length) return [];

		const { baseUrl, token } = await this._creds();
		const dir = path.join(os.tmpdir(), 'mause-task-assets', taskId);
		fs.mkdirSync(dir, { recursive: true });

		const out: KaneoDownloadedAttachment[] = [];
		for (const att of detail.attachments) {
			const safeName = att.filename.replace(/[^\w.\- ()[\]]+/g, '_');
			const localPath = path.join(dir, `${att.id.slice(0, 8)}-${safeName}`);
			try {
				const res = await fetch(`${baseUrl}${att.url}`, {
					headers: {
						Authorization: `Bearer ${token}`,
						'User-Agent': 'Mause-Desktop/1.0',
					},
				});
				if (!res.ok) continue;
				const buf = Buffer.from(await res.arrayBuffer());
				fs.writeFileSync(localPath, buf);
				out.push({
					id: att.id,
					filename: att.filename,
					mimeType: att.mimeType,
					size: att.size,
					localPath,
				});
			} catch {
				// skip failed downloads
			}
		}
		return out;
	}
}
