/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEncryptionMainService } from '../../../../platform/encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import { IKaneoApiService, KaneoProject, KaneoTaskDetail, KaneoTaskSummary } from '../common/kaneoApiService.js';
import { getStoredKaneoAccessToken, getStoredKaneoBaseUrl } from './kaneoTokenStore.js';

// Reads the token/base-url from the same storage kaneoAuthMainService.ts writes to
// (kaneoTokenStore.ts) rather than depending on that service directly - keeps the two
// electron-main services independent and avoids ever exposing the raw token value
// through a channel to the renderer.
export class KaneoApiMainService extends Disposable implements IKaneoApiService {
	_serviceBrand: undefined;

	constructor(
		@IEncryptionMainService private readonly _encryptionService: IEncryptionMainService,
		@IApplicationStorageMainService private readonly _appStorage: IApplicationStorageMainService,
	) {
		super();
	}

	private async _authedFetch(path: string): Promise<any> {
		await this._appStorage.whenReady;
		const baseUrl = getStoredKaneoBaseUrl(this._appStorage);
		const token = await getStoredKaneoAccessToken(this._encryptionService, this._appStorage);
		if (!token) throw new Error('Not signed in to Task Management.');

		const res = await fetch(`${baseUrl}${path}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'Mause-Desktop/1.0',
			},
		});
		if (res.status === 404) return null;
		if (!res.ok) {
			throw new Error(`Kaneo request failed (${res.status}): ${await res.text().catch(() => '')}`);
		}
		return res.json();
	}

	async getMyProjects(): Promise<KaneoProject[]> {
		return (await this._authedFetch('/api/my-work/projects')) ?? [];
	}

	async getMyTasks(): Promise<KaneoTaskSummary[]> {
		return (await this._authedFetch('/api/my-work/tasks')) ?? [];
	}

	async getTaskDetail(taskId: string): Promise<KaneoTaskDetail | null> {
		return await this._authedFetch(`/api/my-work/tasks/${encodeURIComponent(taskId)}`);
	}
}
