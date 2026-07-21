/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { timeout } from '../../../../base/common/async.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IKaneoAuthService } from '../common/kaneoAuthService.js';
import { IKaneoWsService } from '../common/kaneoWsService.js';
import {
	clearPendingAgentTaskId,
	peekPendingAgentTaskId,
	triggerAgentFromTaskId,
} from './kaneoChatInjection.js';

export interface IKaneoTaskTriggerService {
	readonly _serviceBrand: undefined;
}

export const IKaneoTaskTriggerService = createDecorator<IKaneoTaskTriggerService>('kaneoTaskTriggerService');

class KaneoTaskTriggerService extends Disposable implements IKaneoTaskTriggerService {
	_serviceBrand: undefined;

	static readonly ID = 'kaneoTaskTriggerService';

	private readonly _inflightTaskIds = new Set<string>();

	constructor(
		@IKaneoAuthService private readonly kaneoAuthService: IKaneoAuthService,
		@IKaneoWsService private readonly kaneoWsService: IKaneoWsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this._register(this.kaneoAuthService.onDidChangeAuthState(state => {
			void this._syncConnection(state.loggedIn);
		}));

		this._register(this.kaneoWsService.onTaskStatusChanged(event => {
			void this._onTaskStatusChanged(event.taskId);
		}));

		void this.kaneoAuthService.getAuthState().then(state => {
			void this._syncConnection(state.loggedIn);
		});

		// After localPath openWindow reload — auto-send the stashed task (no manual Trigger).
		void this._resumePendingAgentTask();
	}

	private async _syncConnection(loggedIn: boolean): Promise<void> {
		if (loggedIn) {
			await this.kaneoWsService.connect();
		} else {
			await this.kaneoWsService.disconnect();
		}
	}

	private async _resumePendingAgentTask(): Promise<void> {
		const taskId = peekPendingAgentTaskId(this.storageService);
		if (!taskId) {
			return;
		}
		clearPendingAgentTaskId(this.storageService);
		// Let sidebar / chat mount after workspace restore.
		await timeout(800);
		console.log(`[kaneo-task-trigger] resuming auto-send after workspace open taskId=${taskId}`);
		await this._onTaskStatusChanged(taskId);
	}

	private async _onTaskStatusChanged(taskId: string): Promise<void> {
		if (!taskId || this._inflightTaskIds.has(taskId)) {
			return;
		}
		this._inflightTaskIds.add(taskId);
		try {
			await this.instantiationService.invokeFunction(accessor =>
				triggerAgentFromTaskId(accessor, taskId),
			);
		} catch (e) {
			console.error('[kaneo-task-trigger] failed to inject task into chat', e);
		} finally {
			this._inflightTaskIds.delete(taskId);
		}
	}
}

registerWorkbenchContribution2(KaneoTaskTriggerService.ID, KaneoTaskTriggerService, WorkbenchPhase.BlockRestore);
