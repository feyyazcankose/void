/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export interface KaneoDeviceCodeInfo {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete?: string;
	interval: number;
	expiresIn: number;
}

// One poll of /api/auth/device/token. The renderer drives the interval loop (setTimeout
// between calls) rather than main looping internally, so progress is naturally visible
// to whatever UI called requestDeviceCode/pollDeviceToken.
export type KaneoDeviceTokenPollResult =
	| { status: 'pending' }
	| { status: 'complete' }
	| { status: 'denied' }
	| { status: 'expired' }
	| { status: 'error'; message: string };

export interface KaneoAuthState {
	loggedIn: boolean;
	baseUrl: string;
}

export interface IKaneoAuthService {
	readonly _serviceBrand: undefined;
	getAuthState(): Promise<KaneoAuthState>;
	setBaseUrl(url: string): Promise<void>;
	requestDeviceCode(): Promise<KaneoDeviceCodeInfo>;
	pollDeviceToken(deviceCode: string): Promise<KaneoDeviceTokenPollResult>;
	logout(): Promise<void>;
}

export const IKaneoAuthService = createDecorator<IKaneoAuthService>('KaneoAuthService');

// implemented by calling channel - mirrors voidUpdateService.ts
class KaneoAuthService implements IKaneoAuthService {

	readonly _serviceBrand: undefined;
	private readonly kaneoAuthService: IKaneoAuthService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		this.kaneoAuthService = ProxyChannel.toService<IKaneoAuthService>(mainProcessService.getChannel('kaneo-auth'));
	}

	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	getAuthState: IKaneoAuthService['getAuthState'] = async () => this.kaneoAuthService.getAuthState();
	setBaseUrl: IKaneoAuthService['setBaseUrl'] = async (url) => this.kaneoAuthService.setBaseUrl(url);
	requestDeviceCode: IKaneoAuthService['requestDeviceCode'] = async () => this.kaneoAuthService.requestDeviceCode();
	pollDeviceToken: IKaneoAuthService['pollDeviceToken'] = async (deviceCode) => this.kaneoAuthService.pollDeviceToken(deviceCode);
	logout: IKaneoAuthService['logout'] = async () => this.kaneoAuthService.logout();
}

registerSingleton(IKaneoAuthService, KaneoAuthService, InstantiationType.Eager);
