/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import WebSocket from 'ws';

export type KaneoWsRawMessage = { type: string;[key: string]: unknown };

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

export type KaneoWsCredentials = {
	baseUrl: string;
	/** Device-flow session token (Better Auth `session.token`), not an API key. */
	accessToken: string;
};

/**
 * Port of kaneo-agent-runtime's KaneoWsClient. Uses the `ws` package (not WHATWG
 * WebSocket) so we can send auth headers on the handshake. Desktop authenticates
 * with a device-flow session token via `Authorization: Bearer` (same as
 * kaneoApiMainService / kaneoAuthMainService). Agent-runtime uses `x-api-key`
 * because it holds a real Better Auth API key — do not mix the two.
 * Credentials are re-read via `getCredentials` on every connect/reconnect.
 */
export class KaneoWsClient {
	private socket: WebSocket | null = null;
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private closed = false;

	constructor(
		private readonly getCredentials: () => Promise<KaneoWsCredentials | undefined>,
		private readonly onMessage: (message: KaneoWsRawMessage) => void,
		private readonly onConnectionStateChanged: (connected: boolean) => void,
		private readonly label: string,
	) { }

	async connect(): Promise<void> {
		this.closed = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		const credentials = await this.getCredentials();
		if (!credentials?.accessToken || !credentials.baseUrl) {
			console.log(`[ws:${this.label}] no credentials — not connecting`);
			this.onConnectionStateChanged(false);
			return;
		}

		const httpBase = credentials.baseUrl.replace(/\/$/, '');
		const wsUrl = `${httpBase.replace(/^http/, 'ws')}/api/ws/user`;

		try {
			const socket = new WebSocket(wsUrl, {
				headers: {
					Authorization: `Bearer ${credentials.accessToken}`,
					'User-Agent': 'Mause-Desktop/1.0',
				},
			});
			this.socket = socket;

			socket.on('open', () => {
				this.reconnectAttempt = 0;
				console.log(`[ws:${this.label}] connected`);
				this.onConnectionStateChanged(true);
				this.pingInterval = setInterval(() => {
					try {
						socket.send(JSON.stringify({ type: 'ping' }));
					} catch {
						// close handler will reconnect
					}
				}, PING_INTERVAL_MS);
			});

			socket.on('message', (data) => {
				try {
					const message = JSON.parse(data.toString()) as KaneoWsRawMessage;
					this.onMessage(message);
				} catch {
					// ignore malformed
				}
			});

			socket.on('close', () => {
				if (this.pingInterval) {
					clearInterval(this.pingInterval);
					this.pingInterval = null;
				}
				this.socket = null;
				this.onConnectionStateChanged(false);
				if (this.closed) {
					return;
				}

				const delay = Math.min(
					RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt,
					RECONNECT_MAX_DELAY_MS,
				);
				this.reconnectAttempt++;
				console.log(`[ws:${this.label}] disconnected — retrying in ${delay}ms`);
				this.reconnectTimer = setTimeout(() => {
					void this.connect();
				}, delay);
			});

			socket.on('error', (error) => {
				console.error(`[ws:${this.label}] error`, error.message);
			});
		} catch (e) {
			console.error(`[ws:${this.label}] failed to open`, e);
			this.onConnectionStateChanged(false);
			if (!this.closed) {
				const delay = Math.min(
					RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt,
					RECONNECT_MAX_DELAY_MS,
				);
				this.reconnectAttempt++;
				this.reconnectTimer = setTimeout(() => {
					void this.connect();
				}, delay);
			}
		}
	}

	close(): void {
		this.closed = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		this.socket?.close();
		this.socket = null;
		this.onConnectionStateChanged(false);
	}
}
