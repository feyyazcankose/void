/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEncryptionMainService } from '../../../../platform/encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import { IKaneoAuthService, KaneoAuthState, KaneoDeviceCodeInfo, KaneoDeviceTokenPollResult } from '../common/kaneoAuthService.js';
import { clearStoredKaneoAccessToken, getStoredKaneoAccessToken, getStoredKaneoBaseUrl, setStoredKaneoAccessToken, setStoredKaneoBaseUrl } from './kaneoTokenStore.js';

// RFC 8628 device authorization grant against kaneo-task's Better Auth `deviceAuthorization`
// plugin. Request/poll shapes ported from kaneo-task/packages/mcp/src/auth/device-flow.ts
// (an already-working client of the same backend flow) - kept 1:1 with that reference rather
// than re-derived, since it's a proven, tested implementation of the exact same endpoints.
const KANEO_DESKTOP_CLIENT_ID = 'mause-desktop';

export class KaneoAuthMainService extends Disposable implements IKaneoAuthService {
	_serviceBrand: undefined;

	constructor(
		@IEncryptionMainService private readonly _encryptionService: IEncryptionMainService,
		@IApplicationStorageMainService private readonly _appStorage: IApplicationStorageMainService,
	) {
		super();
	}

	private async _baseUrl(): Promise<string> {
		await this._appStorage.whenReady;
		return getStoredKaneoBaseUrl(this._appStorage);
	}

	async getAuthState(): Promise<KaneoAuthState> {
		await this._appStorage.whenReady;
		const baseUrl = getStoredKaneoBaseUrl(this._appStorage);
		const token = await getStoredKaneoAccessToken(this._encryptionService, this._appStorage);
		if (!token) return { loggedIn: false, baseUrl };

		const valid = await this._validateToken(baseUrl, token);
		if (!valid) {
			clearStoredKaneoAccessToken(this._appStorage);
			return { loggedIn: false, baseUrl };
		}
		return { loggedIn: true, baseUrl };
	}

	async setBaseUrl(url: string): Promise<void> {
		await this._appStorage.whenReady;
		setStoredKaneoBaseUrl(this._appStorage, url);
	}

	async requestDeviceCode(): Promise<KaneoDeviceCodeInfo> {
		const baseUrl = await this._baseUrl();
		const res = await fetch(`${baseUrl}/api/auth/device/code`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ client_id: KANEO_DESKTOP_CLIENT_ID }),
		});
		const body: any = await res.json().catch(() => ({}));
		if (!res.ok || typeof body.device_code !== 'string') {
			throw new Error(`Kaneo device/code request failed (${res.status}): ${JSON.stringify(body)}`);
		}
		return {
			deviceCode: body.device_code,
			userCode: body.user_code,
			verificationUri: body.verification_uri,
			verificationUriComplete: body.verification_uri_complete,
			interval: Number(body.interval) || 5,
			expiresIn: Number(body.expires_in) || 900,
		};
	}

	async pollDeviceToken(deviceCode: string): Promise<KaneoDeviceTokenPollResult> {
		const baseUrl = await this._baseUrl();
		try {
			const res = await fetch(`${baseUrl}/api/auth/device/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
					device_code: deviceCode,
					client_id: KANEO_DESKTOP_CLIENT_ID,
				}),
			});
			const body: any = await res.json().catch(() => ({}));

			if (res.ok && typeof body.access_token === 'string') {
				await setStoredKaneoAccessToken(this._encryptionService, this._appStorage, body.access_token);
				return { status: 'complete' };
			}

			const err = typeof body.error === 'string' ? body.error : undefined;
			if (err === 'authorization_pending' || err === 'slow_down') return { status: 'pending' };
			if (err === 'access_denied') return { status: 'denied' };
			if (err === 'expired_token') return { status: 'expired' };
			return { status: 'error', message: `device/token failed (${res.status}): ${JSON.stringify(body)}` };
		} catch (e) {
			return { status: 'error', message: String(e) };
		}
	}

	async logout(): Promise<void> {
		await this._appStorage.whenReady;
		clearStoredKaneoAccessToken(this._appStorage);
	}

	// mirrors kaneo-task/packages/mcp/src/auth/auth-service.ts's validateAccessToken: fail-open
	// on transient/unknown HTTP errors so a network hiccup doesn't force a full device re-login,
	// only a confirmed 401 does.
	private async _validateToken(baseUrl: string, token: string): Promise<boolean> {
		try {
			const res = await fetch(`${baseUrl}/api/auth/get-session`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.status === 401) return false;
			if (!res.ok) return true;
			const data: any = await res.json().catch(() => null);
			return Boolean(data?.user?.id);
		} catch {
			return true;
		}
	}
}
