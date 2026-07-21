/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export interface KaneoTaskStatusChangedEvent {
	type: 'TASK_ASSIGNED_STATUS_CHANGED';
	taskId: string;
	projectId: string;
	projectName: string;
	projectSlug: string;
	taskNumber: number | null;
	title: string;
	fromStatus: string;
	toStatus: string;
	assigneeId: string;
	ruleId: string;
	localPath: string | null;
	occurredAtMs: number;
}

export interface IKaneoWsService {
	readonly _serviceBrand: undefined;
	readonly onTaskStatusChanged: Event<KaneoTaskStatusChangedEvent>;
	readonly onConnectionStateChanged: Event<boolean>;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getConnectionState(): Promise<boolean>;
}

export const IKaneoWsService = createDecorator<IKaneoWsService>('KaneoWsService');

class KaneoWsService extends Disposable implements IKaneoWsService {

	readonly _serviceBrand: undefined;
	private readonly channel: IChannel;

	private readonly _onTaskStatusChanged = this._register(new Emitter<KaneoTaskStatusChangedEvent>());
	readonly onTaskStatusChanged = this._onTaskStatusChanged.event;

	private readonly _onConnectionStateChanged = this._register(new Emitter<boolean>());
	readonly onConnectionStateChanged = this._onConnectionStateChanged.event;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super();
		this.channel = mainProcessService.getChannel('kaneo-ws');

		this._register((this.channel.listen('onTaskStatusChanged') satisfies Event<KaneoTaskStatusChangedEvent>)(e => {
			this._onTaskStatusChanged.fire(e);
		}));
		this._register((this.channel.listen('onConnectionStateChanged') satisfies Event<boolean>)(e => {
			this._onConnectionStateChanged.fire(e);
		}));
	}

	connect: IKaneoWsService['connect'] = async () => this.channel.call('connect');
	disconnect: IKaneoWsService['disconnect'] = async () => this.channel.call('disconnect');
	getConnectionState: IKaneoWsService['getConnectionState'] = async () => this.channel.call('getConnectionState');
}

registerSingleton(IKaneoWsService, KaneoWsService, InstantiationType.Eager);
