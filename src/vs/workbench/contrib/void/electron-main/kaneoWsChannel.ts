/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IEncryptionMainService } from '../../../../platform/encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import { KaneoTaskStatusChangedEvent } from '../common/kaneoWsService.js';
import { KaneoWsClient, KaneoWsRawMessage } from './kaneoWsClient.js';
import { getStoredKaneoAccessToken, getStoredKaneoBaseUrl } from './kaneoTokenStore.js';

export class KaneoWsChannel implements IServerChannel {

	private readonly _onTaskStatusChanged = new Emitter<KaneoTaskStatusChangedEvent>();
	private readonly _onConnectionStateChanged = new Emitter<boolean>();
	private client: KaneoWsClient | null = null;
	private connected = false;

	constructor(
		private readonly encryptionService: IEncryptionMainService,
		private readonly appStorage: IApplicationStorageMainService,
	) { }

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onTaskStatusChanged') {
			return this._onTaskStatusChanged.event;
		}
		if (event === 'onConnectionStateChanged') {
			return this._onConnectionStateChanged.event;
		}
		throw new Error(`KaneoWsChannel: Event not found: ${event}`);
	}

	async call(_: unknown, command: string, _params?: any): Promise<any> {
		if (command === 'connect') {
			await this._connect();
			return;
		}
		if (command === 'disconnect') {
			this._disconnect();
			return;
		}
		if (command === 'getConnectionState') {
			return this.connected;
		}
		throw new Error(`KaneoWsChannel: command "${command}" not recognized.`);
	}

	private async _connect(): Promise<void> {
		this._disconnect();
		this.client = new KaneoWsClient(
			async () => {
				const accessToken = await getStoredKaneoAccessToken(this.encryptionService, this.appStorage);
				if (!accessToken) {
					return undefined;
				}
				return {
					baseUrl: getStoredKaneoBaseUrl(this.appStorage),
					accessToken,
				};
			},
			(message) => this._handleMessage(message),
			(isConnected) => {
				this.connected = isConnected;
				this._onConnectionStateChanged.fire(isConnected);
			},
			'kaneo-desktop',
		);
		await this.client.connect();
	}

	private _disconnect(): void {
		this.client?.close();
		this.client = null;
		this.connected = false;
	}

	private _handleMessage(message: KaneoWsRawMessage): void {
		if (message.type !== 'TASK_ASSIGNED_STATUS_CHANGED') {
			return;
		}
		const event: KaneoTaskStatusChangedEvent = {
			type: 'TASK_ASSIGNED_STATUS_CHANGED',
			taskId: String(message.taskId ?? ''),
			projectId: String(message.projectId ?? ''),
			projectName: String(message.projectName ?? ''),
			projectSlug: String(message.projectSlug ?? ''),
			taskNumber: typeof message.taskNumber === 'number' ? message.taskNumber : null,
			title: String(message.title ?? ''),
			fromStatus: String(message.fromStatus ?? ''),
			toStatus: String(message.toStatus ?? ''),
			assigneeId: String(message.assigneeId ?? ''),
			ruleId: String(message.ruleId ?? ''),
			localPath: typeof message.localPath === 'string' && message.localPath ? message.localPath : null,
			occurredAtMs: typeof message.occurredAtMs === 'number' ? message.occurredAtMs : Date.now(),
		};
		if (!event.taskId) {
			return;
		}
		console.log(`[kaneo-ws] TASK_ASSIGNED_STATUS_CHANGED taskId=${event.taskId}`);
		this._onTaskStatusChanged.fire(event);
	}
}
