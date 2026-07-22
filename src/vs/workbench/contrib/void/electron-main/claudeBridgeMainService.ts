/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * In-process Claude CLI → OpenAI-compatible HTTP bridge.
 *
 * Formerly a standalone `claude-void-bridge/server.js` that had to be started
 * separately. Now lives inside Electron main and starts/stops with the app so
 * Void's OpenAI-Compatible provider can hit 127.0.0.1:8787 without a second process.
 *
 * Requires `claude auth login` once in a normal terminal (subscription, no API key).
 *
 * Claude is spawned with cwd = the focused/last-active window's workspace folder
 * (or Kaneo "Local workspace path" from the prompt when present), so the CLI
 * session is locked to the open project — not the Electron app's launch dir.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWindowsMainService } from '../../../../platform/windows/electron-main/windows.js';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspacesManagementMainService } from '../../../../platform/workspaces/electron-main/workspacesManagementMainService.js';
import { CLAUDE_BRIDGE_ENDPOINT, CLAUDE_BRIDGE_PORT, IClaudeBridgeService } from '../common/claudeBridgeService.js';

const MODELS = ['sonnet', 'opus', 'haiku'] as const;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

function mapModel(name: string | undefined): string {
	const n = (name || '').toLowerCase();
	if (n.includes('opus')) {
		return 'opus';
	}
	if (n.includes('haiku')) {
		return 'haiku';
	}
	return 'sonnet';
}

function contentToText(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text || ''))
			.join('');
	}
	return '';
}

function buildPrompt(messages: Array<{ role?: string; content?: unknown }> | undefined): { systemPrompt: string; prompt: string } {
	const systemParts: string[] = [];
	const turns: string[] = [];
	for (const m of messages || []) {
		const text = contentToText(m.content);
		if (!text) {
			continue;
		}
		if (m.role === 'system') {
			systemParts.push(text);
		} else if (m.role === 'user') {
			turns.push(`Human: ${text}`);
		} else if (m.role === 'assistant') {
			turns.push(`Assistant: ${text}`);
		}
	}
	return { systemPrompt: systemParts.join('\n\n'), prompt: turns.join('\n\n') };
}

/** Kaneo task prompts include `- Local workspace path: /abs/path`. Prefer that when valid. */
function extractKaneoLocalPath(prompt: string): string | undefined {
	const m = prompt.match(/^- Local workspace path:\s*(.+)$/m);
	if (!m) {
		return undefined;
	}
	const p = m[1].trim();
	if (!p || p.startsWith('(')) {
		return undefined;
	}
	try {
		if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
			return p;
		}
	} catch {
		// ignore
	}
	return undefined;
}

function runClaude({
	prompt,
	systemPrompt,
	model,
	cwd,
}: {
	prompt: string;
	systemPrompt: string;
	model: string | undefined;
	cwd: string | undefined;
}): Promise<string> {
	return new Promise((resolve, reject) => {
		const args = [
			'-p', prompt,
			'--output-format', 'stream-json',
			'--verbose',
			'--no-session-persistence',
			'--model', mapModel(model),
		];
		if (systemPrompt) {
			args.push('--system-prompt', systemPrompt);
		}

		const child = spawn(CLAUDE_BIN, args, {
			cwd: cwd || undefined,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let buf = '';
		let stderr = '';
		let finalText: string | null = null;
		let isError = false;

		child.stdout.on('data', (chunk: Buffer) => {
			buf += chunk.toString('utf8');
			let idx: number;
			while ((idx = buf.indexOf('\n')) !== -1) {
				const line = buf.slice(0, idx);
				buf = buf.slice(idx + 1);
				if (!line.trim()) {
					continue;
				}
				try {
					const evt = JSON.parse(line);
					if (evt.type === 'result') {
						finalText = evt.result ?? '';
						isError = !!evt.is_error;
					}
				} catch {
					// ignore malformed lines
				}
			}
		});
		child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

		child.on('error', (err) => reject(err));
		child.on('close', () => {
			if (finalText === null) {
				reject(new Error(stderr || 'claude CLI produced no result'));
			} else if (isError) {
				reject(new Error(finalText));
			} else {
				resolve(finalText);
			}
		});
	});
}

function sseChunk(res: http.ServerResponse, id: string, model: string | undefined, delta: object, finishReason?: string | null): void {
	const payload = {
		id,
		object: 'chat.completion.chunk',
		created: Math.floor(Date.now() / 1000),
		model,
		choices: [{ index: 0, delta, finish_reason: finishReason ?? null }],
	};
	res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function* streamPieces(text: string): Generator<string> {
	const words = text.split(/(\s+)/);
	let buf = '';
	for (const w of words) {
		buf += w;
		if (buf.length >= 6) {
			yield buf;
			buf = '';
		}
	}
	if (buf) {
		yield buf;
	}
}

function handleModels(_req: http.IncomingMessage, res: http.ServerResponse): void {
	const now = Math.floor(Date.now() / 1000);
	res.writeHead(200, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({
		object: 'list',
		data: MODELS.map((id) => ({ id, object: 'model', created: now, owned_by: 'anthropic' })),
	}));
}

export class ClaudeBridgeMainService extends Disposable implements IClaudeBridgeService {
	_serviceBrand: undefined;

	readonly port = CLAUDE_BRIDGE_PORT;
	readonly endpoint = CLAUDE_BRIDGE_ENDPOINT;

	private _server: http.Server | undefined;
	private _listening = false;

	get isListening(): boolean {
		return this._listening;
	}

	constructor(
		@ILogService private readonly logService: ILogService,
		@IWindowsMainService private readonly windowsMainService: IWindowsMainService,
		@IWorkspacesManagementMainService private readonly workspacesManagementMainService: IWorkspacesManagementMainService,
	) {
		super();
		this._start();
		this._register({ dispose: () => this._stop() });
	}

	/** Prefer Kaneo path in prompt; else focused/last-active window's local folder. */
	private async _resolveCwd(prompt: string): Promise<string | undefined> {
		const fromPrompt = extractKaneoLocalPath(prompt);
		if (fromPrompt) {
			return fromPrompt;
		}

		const win = this.windowsMainService.getFocusedWindow()
			?? this.windowsMainService.getLastActiveWindow();
		const ws = win?.openedWorkspace;
		if (!ws) {
			return undefined;
		}

		if (isSingleFolderWorkspaceIdentifier(ws) && ws.uri.scheme === Schemas.file) {
			return ws.uri.fsPath;
		}

		if (isWorkspaceIdentifier(ws) && ws.configPath.scheme === Schemas.file) {
			try {
				const resolved = await this.workspacesManagementMainService.resolveLocalWorkspace(ws.configPath);
				const folder = resolved?.folders.find(f => f.uri.scheme === Schemas.file);
				return folder?.uri.fsPath;
			} catch (e) {
				this.logService.warn(`[ClaudeBridge] resolveLocalWorkspace failed: ${(e as Error)?.message || e}`);
			}
		}

		return undefined;
	}

	private async _handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse, body: string): Promise<void> {
		let parsed: { messages?: Array<{ role?: string; content?: unknown }>; model?: string; stream?: boolean };
		try {
			parsed = JSON.parse(body || '{}');
		} catch {
			res.writeHead(400, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: { message: 'invalid JSON body' } }));
			return;
		}

		const { messages, model, stream } = parsed;
		const { systemPrompt, prompt } = buildPrompt(messages);
		const id = 'chatcmpl-' + Math.random().toString(36).slice(2);
		const cwd = await this._resolveCwd(`${systemPrompt}\n${prompt}`);
		this.logService.info(`[ClaudeBridge] spawning claude cwd=${cwd ?? '(inherit)'}`);

		let text: string;
		try {
			text = await runClaude({ prompt, systemPrompt, model, cwd });
		} catch (err) {
			const message = (err as Error)?.message || String(err);
			if (stream) {
				res.writeHead(200, {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
				});
				sseChunk(res, id, model, { role: 'assistant', content: `[claude-cli error] ${message}` }, 'stop');
				res.write('data: [DONE]\n\n');
				res.end();
			} else {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model,
					choices: [{ index: 0, message: { role: 'assistant', content: `[claude-cli error] ${message}` }, finish_reason: 'stop' }],
				}));
			}
			return;
		}

		if (stream) {
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			});
			sseChunk(res, id, model, { role: 'assistant' });
			for (const piece of streamPieces(text)) {
				sseChunk(res, id, model, { content: piece });
				await new Promise((r) => setTimeout(r, 12));
			}
			sseChunk(res, id, model, {}, 'stop');
			res.write('data: [DONE]\n\n');
			res.end();
		} else {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({
				id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model,
				choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
			}));
		}
	}

	private _start(): void {
		const server = http.createServer((req, res) => {
			if (req.method === 'GET' && req.url?.startsWith('/v1/models')) {
				return handleModels(req, res);
			}
			if (req.method === 'POST' && req.url?.startsWith('/v1/chat/completions')) {
				let body = '';
				req.on('data', (c) => { body += c; });
				req.on('end', () => { void this._handleChatCompletions(req, res, body); });
				return;
			}
			res.writeHead(404, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: { message: 'not found' } }));
		});

		server.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				// Another instance (or a leftover standalone bridge) already owns the port —
				// treat that as success so chat still works.
				this.logService.info(`[ClaudeBridge] port ${this.port} already in use; reusing existing listener`);
				this._listening = true;
				return;
			}
			this.logService.error(`[ClaudeBridge] failed to start: ${err.message}`);
		});

		server.listen(this.port, '127.0.0.1', () => {
			this._listening = true;
			this.logService.info(`[ClaudeBridge] listening on ${this.endpoint}`);
		});

		this._server = server;
	}

	private _stop(): void {
		const server = this._server;
		this._server = undefined;
		this._listening = false;
		if (!server) {
			return;
		}
		server.close((err) => {
			if (err) {
				this.logService.warn(`[ClaudeBridge] error while stopping: ${err.message}`);
			} else {
				this.logService.info('[ClaudeBridge] stopped');
			}
		});
	}
}
