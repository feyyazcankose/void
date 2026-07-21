/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// past values:
// 'void.settingsServiceStorage'
// 'void.settingsServiceStorageI' // 1.0.2

// 1.0.3
export const VOID_SETTINGS_STORAGE_KEY = 'void.settingsServiceStorageII'


// past values:
// 'void.chatThreadStorage'
// 'void.chatThreadStorageI' // 1.0.2

// 1.0.3
export const THREAD_STORAGE_KEY = 'void.chatThreadStorageII'



export const OPT_OUT_KEY = 'void.app.optOutAll'


// Kaneo Task Management integration (application-scope, main-process storage)
export const KANEO_BASE_URL_STORAGE_KEY = 'kaneo.baseUrl.I'
export const KANEO_ACCESS_TOKEN_STORAGE_KEY = 'kaneo.accessToken.I'
/** Survives workspace folder switch (openWindow reload) so agent can auto-send after reopen. */
export const KANEO_PENDING_AGENT_TASK_ID_KEY = 'kaneo.pendingAgentTaskId.I'
