/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { StagingSelectionItem } from '../common/chatThreadServiceTypes.js';
import { IKaneoApiService, KaneoDownloadedAttachment, KaneoTaskDetail } from '../common/kaneoApiService.js';
import { KANEO_PENDING_AGENT_TASK_ID_KEY } from '../common/storageKeys.js';
import { IVoidSCMService } from '../common/voidSCMTypes.js';
import { IChatThreadService } from './chatThreadService.js';

/** Same id as React `commandIds.ts` — keep the literal in sync (React must not import this file). */
export const VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID = 'void.triggerAgentFromTask';

const VOID_OPEN_SIDEBAR_ACTION_ID = 'void.sidebar.open';

const TEXTISH_EXT = new Set([
	'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'txt', 'csv',
	'yml', 'yaml', 'toml', 'xml', 'html', 'css', 'scss', 'less', 'svg',
	'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp',
	'sh', 'bash', 'zsh', 'env', 'gitignore', 'sql', 'graphql', 'prisma',
]);

function guessLanguage(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
		json: 'json', md: 'markdown', py: 'python', css: 'css', html: 'html',
		yml: 'yaml', yaml: 'yaml', sql: 'sql', sh: 'shellscript',
	};
	return map[ext] ?? 'plaintext';
}

function isTextishAttachment(att: KaneoDownloadedAttachment): boolean {
	const mime = (att.mimeType || '').toLowerCase();
	if (mime.startsWith('text/')) return true;
	if (mime.includes('json') || mime.includes('javascript') || mime.includes('xml') || mime.includes('svg')) return true;
	const ext = att.filename.split('.').pop()?.toLowerCase() ?? '';
	return TEXTISH_EXT.has(ext);
}

export function buildTaskAgentPrompt(
	task: KaneoTaskDetail,
	downloaded: KaneoDownloadedAttachment[] = [],
	_opts?: { activeBranch?: string | null },
): string {
	// Description-only works; metadata-heavy prompts make Claude chase the wrong feature.
	const description = (task.description?.trim() || task.title?.trim() || '').trim();
	const parts: string[] = [description];

	if (task.comments.length) {
		parts.push(
			'',
			'Comments:',
			...task.comments.map(c => `- ${c.authorName}: ${c.content}`),
		);
	}

	if (downloaded.some(isTextishAttachment)) {
		parts.push('', 'Text attachments are attached as file selections — read them.');
	}

	return parts.join('\n').trim();
}

function selectionsFromDownloads(downloaded: KaneoDownloadedAttachment[]): StagingSelectionItem[] {
	return downloaded.filter(isTextishAttachment).map(d => ({
		type: 'File' as const,
		uri: URI.file(d.localPath),
		language: guessLanguage(d.filename),
		state: { wasAddedAsCurrentFile: false },
	}));
}

function normalizeFsPath(fsPath: string): string {
	return fsPath.replace(/\/$/, '');
}

function isLocalWorkspaceOpen(
	workspaceService: IWorkspaceContextService,
	localPath: string,
): boolean {
	const target = URI.file(localPath);
	const folders = workspaceService.getWorkspace().folders;
	return folders.some(f =>
		f.uri.scheme === target.scheme &&
		normalizeFsPath(f.uri.fsPath) === normalizeFsPath(target.fsPath),
	);
}

/**
 * Resolve every service from `accessor` before the first `await`.
 * VS Code invalidates ServicesAccessor as soon as the sync invokeFunction / command
 * frame returns — keeping the accessor across awaits throws
 * "Illegal state: service accessor is only valid during the invocation...".
 */
function resolveInjectServices(accessor: ServicesAccessor) {
	return {
		kaneoApi: accessor.get(IKaneoApiService),
		commandService: accessor.get(ICommandService),
		chat: accessor.get(IChatThreadService),
		workspaceService: accessor.get(IWorkspaceContextService),
		hostService: accessor.get(IHostService),
		storageService: accessor.get(IStorageService),
		scm: accessor.get(IVoidSCMService),
	};
}

type InjectServices = Omit<ReturnType<typeof resolveInjectServices>, 'kaneoApi' | 'storageService'>;

async function maybeCreateAgentBranch(
	scm: IVoidSCMService,
	task: KaneoTaskDetail,
): Promise<string | null> {
	if (!task.agentAutoCreateBranch) {
		return null;
	}
	const localPath = task.localPath?.trim();
	const branchName = task.suggestedBranchName?.trim();
	if (!localPath || !branchName) {
		return null;
	}
	try {
		const created = await scm.gitCreateAndCheckoutBranch(localPath, branchName);
		console.log(`[kaneo-chat-injection] checked out branch=${created}`);
		return created;
	} catch (e) {
		console.warn('[kaneo-chat-injection] branch create/checkout failed', e);
		return null;
	}
}

async function injectTaskIntoChatWithServices(
	services: InjectServices,
	task: KaneoTaskDetail,
	downloaded: KaneoDownloadedAttachment[],
	activeBranch: string | null,
): Promise<void> {
	const { commandService, chat } = services;

	await commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID);
	chat.openNewThread();
	const threadId = chat.state.currentThreadId;
	const userMessage = buildTaskAgentPrompt(task, downloaded, { activeBranch });
	const _chatSelections = selectionsFromDownloads(downloaded);
	await chat.addUserMessageAndStreamResponse({ userMessage, threadId, _chatSelections });
	await chat.focusCurrentChat();
}

export async function injectTaskIntoChat(
	accessor: ServicesAccessor,
	task: KaneoTaskDetail,
	downloaded: KaneoDownloadedAttachment[] = [],
): Promise<void> {
	const { commandService, chat, workspaceService, hostService, scm } = resolveInjectServices(accessor);
	const activeBranch = await maybeCreateAgentBranch(scm, task);
	await injectTaskIntoChatWithServices({ commandService, chat, workspaceService, hostService, scm }, task, downloaded, activeBranch);
}

/**
 * Auto-send task into chat (open sidebar → new thread → stream).
 * If `localPath` requires switching folders, `openWindow` reloads the workbench —
 * we stash the task id and resume inject after reload (see KaneoTaskTriggerService).
 */
export async function triggerAgentFromTaskId(
	accessor: ServicesAccessor,
	taskId: string,
): Promise<void> {
	const {
		kaneoApi,
		commandService,
		chat,
		workspaceService,
		hostService,
		storageService,
		scm,
	} = resolveInjectServices(accessor);

	const task = await kaneoApi.getTaskDetail(taskId);
	if (!task) {
		return;
	}

	const localPath = task.localPath?.trim() || null;
	if (localPath && !isLocalWorkspaceOpen(workspaceService, localPath)) {
		// Persist before reload — inject cannot finish in the dying window.
		storageService.store(
			KANEO_PENDING_AGENT_TASK_ID_KEY,
			taskId,
			StorageScope.APPLICATION,
			StorageTarget.MACHINE,
		);
		console.log(`[kaneo-chat-injection] opening workspace then will auto-send taskId=${taskId}`);
		await hostService.openWindow([{ folderUri: URI.file(localPath) }], { forceReuseWindow: true });
		return;
	}

	storageService.remove(KANEO_PENDING_AGENT_TASK_ID_KEY, StorageScope.APPLICATION);

	const activeBranch = await maybeCreateAgentBranch(scm, task);

	let downloaded: KaneoDownloadedAttachment[] = [];
	try {
		downloaded = await kaneoApi.downloadTaskAttachments(taskId);
	} catch (e) {
		console.warn('[kaneo-chat-injection] attachment download failed', e);
	}

	await injectTaskIntoChatWithServices({ commandService, chat, workspaceService, hostService, scm }, task, downloaded, activeBranch);
}

export function peekPendingAgentTaskId(storageService: IStorageService): string | undefined {
	return storageService.get(KANEO_PENDING_AGENT_TASK_ID_KEY, StorageScope.APPLICATION) || undefined;
}

export function clearPendingAgentTaskId(storageService: IStorageService): void {
	storageService.remove(KANEO_PENDING_AGENT_TASK_ID_KEY, StorageScope.APPLICATION);
}

CommandsRegistry.registerCommand(
	VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID,
	async (accessor, taskId: string) => {
		if (typeof taskId !== 'string' || !taskId) {
			return;
		}
		await triggerAgentFromTaskId(accessor, taskId);
	},
);
