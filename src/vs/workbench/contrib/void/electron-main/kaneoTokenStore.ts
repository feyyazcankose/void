/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IEncryptionMainService } from '../../../../platform/encryption/common/encryptionService.js';
import { StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IApplicationStorageMainService } from '../../../../platform/storage/electron-main/storageMainService.js';
import { KANEO_ACCESS_TOKEN_STORAGE_KEY, KANEO_BASE_URL_STORAGE_KEY } from '../common/storageKeys.js';

// Shared by kaneoAuthMainService.ts and kaneoApiMainService.ts (both electron-main, both
// need the token) so the raw token value never has to be exposed through a channel/proxy
// to the renderer - only connection *state* (logged in/out) crosses that boundary.

const DEFAULT_KANEO_BASE_URL = 'http://localhost:1337';

export function getStoredKaneoBaseUrl(appStorage: IApplicationStorageMainService): string {
	return appStorage.get(KANEO_BASE_URL_STORAGE_KEY, StorageScope.APPLICATION, DEFAULT_KANEO_BASE_URL);
}

export function setStoredKaneoBaseUrl(appStorage: IApplicationStorageMainService, url: string): void {
	const trimmed = url.trim().replace(/\/$/, '');
	appStorage.store(KANEO_BASE_URL_STORAGE_KEY, trimmed, StorageScope.APPLICATION, StorageTarget.MACHINE);
}

export async function getStoredKaneoAccessToken(
	encryptionService: IEncryptionMainService,
	appStorage: IApplicationStorageMainService,
): Promise<string | undefined> {
	const encrypted = appStorage.get(KANEO_ACCESS_TOKEN_STORAGE_KEY, StorageScope.APPLICATION);
	if (!encrypted) return undefined;
	try {
		return await encryptionService.decrypt(encrypted);
	} catch (e) {
		console.error('[kaneo-auth] failed to decrypt stored access token, clearing it', e);
		appStorage.remove(KANEO_ACCESS_TOKEN_STORAGE_KEY, StorageScope.APPLICATION);
		return undefined;
	}
}

export async function setStoredKaneoAccessToken(
	encryptionService: IEncryptionMainService,
	appStorage: IApplicationStorageMainService,
	token: string,
): Promise<void> {
	const encrypted = await encryptionService.encrypt(token);
	// MACHINE (not USER/synced): an access token must never leave this machine via Settings Sync.
	appStorage.store(KANEO_ACCESS_TOKEN_STORAGE_KEY, encrypted, StorageScope.APPLICATION, StorageTarget.MACHINE);
}

export function clearStoredKaneoAccessToken(appStorage: IApplicationStorageMainService): void {
	appStorage.remove(KANEO_ACCESS_TOKEN_STORAGE_KEY, StorageScope.APPLICATION);
}
