/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
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
const KANEO_DESKTOP_USER_AGENT = 'Mause-Desktop/1.0';

type KaneoSessionUser = { id: string; name?: string };

export class KaneoAuthMainService extends Disposable implements IKaneoAuthService {
	_serviceBrand: undefined;

	private readonly _onDidChangeAuthState = this._register(new Emitter<KaneoAuthState>());
	readonly onDidChangeAuthState = this._onDidChangeAuthState.event;

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

	private _fire(state: KaneoAuthState): void {
		this._onDidChangeAuthState.fire(state);
	}

	async getAuthState(): Promise<KaneoAuthState> {
		await this._appStorage.whenReady;
		const baseUrl = getStoredKaneoBaseUrl(this._appStorage);
		const token = await getStoredKaneoAccessToken(this._encryptionService, this._appStorage);
		if (!token) {
			return { loggedIn: false, baseUrl };
		}

		const user = await this._fetchSessionUser(baseUrl, token);
		if (user === false) {
			clearStoredKaneoAccessToken(this._appStorage);
			const state: KaneoAuthState = { loggedIn: false, baseUrl };
			this._fire(state);
			return state;
		}
		return {
			loggedIn: true,
			baseUrl,
			userName: user?.name,
		};
	}

	async setBaseUrl(url: string): Promise<void> {
		await this._appStorage.whenReady;
		setStoredKaneoBaseUrl(this._appStorage, url);
	}

	async requestDeviceCode(): Promise<KaneoDeviceCodeInfo> {
		const baseUrl = await this._baseUrl();
		const res = await fetch(`${baseUrl}/api/auth/device/code`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': KANEO_DESKTOP_USER_AGENT,
			},
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
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': KANEO_DESKTOP_USER_AGENT,
				},
				body: JSON.stringify({
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
					device_code: deviceCode,
					client_id: KANEO_DESKTOP_CLIENT_ID,
				}),
			});
			const body: any = await res.json().catch(() => ({}));

			if (res.ok && typeof body.access_token === 'string') {
				await setStoredKaneoAccessToken(this._encryptionService, this._appStorage, body.access_token);
				const user = await this._fetchSessionUser(baseUrl, body.access_token);
				this._fire({
					loggedIn: true,
					baseUrl,
					userName: user && user !== false ? user.name : undefined,
				});
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
		const baseUrl = getStoredKaneoBaseUrl(this._appStorage);
		const token = await getStoredKaneoAccessToken(this._encryptionService, this._appStorage);
		if (token) {
			try {
				await fetch(`${baseUrl}/api/auth/revoke-session`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
						'User-Agent': KANEO_DESKTOP_USER_AGENT,
					},
					body: JSON.stringify({ token }),
				});
			} catch {
				// Always clear local token even if revoke fails (offline / already revoked).
			}
		}
		clearStoredKaneoAccessToken(this._appStorage);
		this._fire({ loggedIn: false, baseUrl });
	}

	// mirrors kaneo-task/packages/mcp/src/auth/auth-service.ts's validateAccessToken: fail-open
	// on transient/unknown HTTP errors so a network hiccup doesn't force a full device re-login,
	// only a confirmed 401 does.
	// Returns: session user | false (401 invalid) | undefined (fail-open / unknown).
	private async _fetchSessionUser(baseUrl: string, token: string): Promise<KaneoSessionUser | false | undefined> {
		try {
			const res = await fetch(`${baseUrl}/api/auth/get-session`, {
				headers: {
					Authorization: `Bearer ${token}`,
					'User-Agent': KANEO_DESKTOP_USER_AGENT,
				},
			});
			if (res.status === 401) return false;
			if (!res.ok) return undefined;
			const data: any = await res.json().catch(() => null);
			if (!data?.user?.id) return undefined;
			return {
				id: String(data.user.id),
				name: typeof data.user.name === 'string' ? data.user.name : undefined,
			};
		} catch {
			return undefined;
		}
	}
}
