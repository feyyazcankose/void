/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/** Default listen port for the in-process Claude CLI → OpenAI-compatible bridge. */
export const CLAUDE_BRIDGE_PORT = 8787;

/** OpenAI-compatible base URL that Void's openAICompatible provider should use. */
export const CLAUDE_BRIDGE_ENDPOINT = `http://127.0.0.1:${CLAUDE_BRIDGE_PORT}/v1`;

export interface IClaudeBridgeService {
	readonly _serviceBrand: undefined;
	readonly port: number;
	readonly endpoint: string;
	readonly isListening: boolean;
}

export const IClaudeBridgeService = createDecorator<IClaudeBridgeService>('ClaudeBridgeService');
