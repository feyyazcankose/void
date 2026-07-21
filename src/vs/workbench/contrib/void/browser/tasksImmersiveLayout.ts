/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

/** Left chrome + bottom panel. Chat (AUXILIARYBAR) is left alone so it stays open if open. */
const IMMERSIVE_PARTS = [
	Parts.ACTIVITYBAR_PART,
	Parts.SIDEBAR_PART,
	Parts.PANEL_PART,
] as const;

type ImmersivePart = typeof IMMERSIVE_PARTS[number];

type VisibilitySnapshot = Record<ImmersivePart, boolean>;

let snapshot: VisibilitySnapshot | undefined;

/** True when the active editor is the Tasks board or a Task Detail pane. */
export function isTasksModeResource(resource: URI | undefined | null): boolean {
	if (!resource || resource.scheme !== 'void') {
		return false;
	}
	// URI.from({ path: 'tasks' }) normalizes to path '/tasks'
	const path = resource.path.replace(/^\//, '');
	return path === 'tasks' || path === 'task-detail';
}

/**
 * Hide left workbench chrome (activity bar, explorer) and the bottom panel.
 * Chat/auxiliary bar is not touched. First call snapshots prior visibility
 * so exit can restore it; later calls re-apply hide without overwriting snapshot.
 */
export function enterTasksImmersive(layoutService: IWorkbenchLayoutService): void {
	if (!snapshot) {
		snapshot = {
			[Parts.ACTIVITYBAR_PART]: layoutService.isVisible(Parts.ACTIVITYBAR_PART),
			[Parts.SIDEBAR_PART]: layoutService.isVisible(Parts.SIDEBAR_PART),
			[Parts.PANEL_PART]: layoutService.isVisible(Parts.PANEL_PART),
		};
	}

	for (const part of IMMERSIVE_PARTS) {
		layoutService.setPartHidden(true, part);
	}
}

/**
 * Restore chrome visibility from the enter-time snapshot. No-op if not immersive.
 */
export function exitTasksImmersive(layoutService: IWorkbenchLayoutService): void {
	if (!snapshot) {
		return;
	}

	const toRestore = snapshot;
	snapshot = undefined;

	for (const part of IMMERSIVE_PARTS) {
		// setPartHidden(false) shows the part; only restore parts that were visible
		layoutService.setPartHidden(!toRestore[part], part);
	}
}

/**
 * Keeps immersive layout in sync with the active editor: Tasks / Task Detail
 * enter immersive mode; anything else exits and restores prior chrome.
 */
export class TasksImmersiveLayoutContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.void.tasksImmersiveLayout';

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(this.editorService.onDidActiveEditorChange(() => this._sync()));
		this._sync();
		queueMicrotask(() => this._sync());
	}

	private _sync(): void {
		if (isTasksModeResource(this.editorService.activeEditor?.resource)) {
			enterTasksImmersive(this.layoutService);
		} else {
			exitTasksImmersive(this.layoutService);
		}
	}
}

registerWorkbenchContribution2(
	TasksImmersiveLayoutContribution.ID,
	TasksImmersiveLayoutContribution,
	WorkbenchPhase.AfterRestored,
);
