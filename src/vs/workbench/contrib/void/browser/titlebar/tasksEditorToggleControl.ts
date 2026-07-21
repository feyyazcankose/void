/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType } from '../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { EditorsOrder } from '../../../../common/editor.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { isTasksModeResource } from '../tasksImmersiveLayout.js';

// Kept as literal constants (not imported from voidTasksPane.ts) to avoid a circular
// import: voidTasksPane.ts is the file that imports *this* module to register the control.
const VOID_TOGGLE_TASKS_ACTION_ID = 'workbench.action.toggleVoidTasks';

/**
 * The "Tasks | Editor" segmented pill contributed into the title bar's left content
 * region (see registerTitleBarLeftContentContribution in titlebarPart.ts).
 */
export class TasksEditorToggleControl {

	private readonly _disposables = new DisposableStore();
	readonly element: HTMLElement = document.createElement('div');

	private readonly _tasksPill: HTMLElement;
	private readonly _editorPill: HTMLElement;

	constructor(
		@ICommandService private readonly commandService: ICommandService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		this.element.classList.add('void-tasks-toggle');

		this._tasksPill = document.createElement('div');
		this._tasksPill.innerText = localize('voidTasksPill', "Tasks");
		this.element.appendChild(this._tasksPill);

		this._editorPill = document.createElement('div');
		this._editorPill.innerText = localize('voidEditorPill', "Editor");
		this.element.appendChild(this._editorPill);

		this._disposables.add(addDisposableListener(this._tasksPill, EventType.CLICK, () => {
			this.commandService.executeCommand(VOID_TOGGLE_TASKS_ACTION_ID);
		}));

		this._disposables.add(addDisposableListener(this._editorPill, EventType.CLICK, () => {
			// Leave Tasks mode: close Tasks board + any Task Detail tabs. Immersive
			// chrome restore is driven by onDidActiveEditorChange in tasksImmersiveLayout.
			if (!isTasksModeResource(this.editorService.activeEditor?.resource)) {
				return;
			}
			const toClose = this.editorService.getEditors(EditorsOrder.SEQUENTIAL).filter(
				({ editor }) => isTasksModeResource(editor.resource)
			);
			if (toClose.length > 0) {
				this.editorService.closeEditors(toClose);
			}
		}));

		this._disposables.add(this.editorService.onDidActiveEditorChange(() => this._updateActiveState()));
		this._updateActiveState();
	}

	private _updateActiveState(): void {
		const isTasksActive = isTasksModeResource(this.editorService.activeEditor?.resource);
		this._tasksPill.classList.toggle('active', isTasksActive);
		this._editorPill.classList.toggle('active', !isTasksActive);
	}

	dispose(): void {
		this._disposables.dispose();
	}
}
