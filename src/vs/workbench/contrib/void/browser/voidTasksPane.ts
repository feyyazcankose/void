/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import * as nls from '../../../../nls.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';

import { mountVoidTasks } from './react/out/tasks-tsx/index.js'
import { Codicon } from '../../../../base/common/codicons.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { registerTitleBarLeftContentContribution } from '../../../browser/parts/titlebar/titlebarPart.js';
import { TasksEditorToggleControl } from './titlebar/tasksEditorToggleControl.js';
// Tasks immersive layout: hide activity bar / explorer / chat / panel while Tasks is active
import './tasksImmersiveLayout.js';


// mirrors voidSettingsPane.ts's VoidSettingsInput/VoidSettingsPane pattern

export class VoidTasksInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.tasks';

	static readonly RESOURCE = URI.from({ // same "invalid scheme, just shuts up TS" trick as VoidSettingsInput
		scheme: 'void',
		path: 'tasks'
	})
	readonly resource = VoidTasksInput.RESOURCE;

	constructor() {
		super();
	}

	override get typeId(): string {
		return VoidTasksInput.ID;
	}

	override getName(): string {
		return nls.localize('voidTasksInputName', 'Void\'s Tasks');
	}

	override getIcon() {
		return Codicon.project
	}

}


class VoidTasksPane extends EditorPane {
	static readonly ID = 'workbench.void.tasksPane';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(VoidTasksPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';

		const tasksElt = document.createElement('div');
		tasksElt.style.height = '100%';
		tasksElt.style.width = '100%';

		parent.appendChild(tasksElt);

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn = mountVoidTasks(tasksElt, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()))
		});
	}

	layout(dimension: Dimension): void {
		// no-op, matches VoidSettingsPane
	}

	override get minimumWidth() { return 900 }

}

// register Tasks pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(VoidTasksPane, VoidTasksPane.ID, nls.localize('VoidTasksPane', "Void\'s Tasks Pane")),
	[new SyncDescriptor(VoidTasksInput)]
);


export const VOID_TOGGLE_TASKS_ACTION_ID = 'workbench.action.toggleVoidTasks'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_TOGGLE_TASKS_ACTION_ID,
			title: nls.localize2('voidTasks', "Void: Toggle Tasks"),
			icon: Codicon.project,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editorGroupService = accessor.get(IEditorGroupsService);
		const instantiationService = accessor.get(IInstantiationService);

		// if is open, close it (or focus it if open but not active)
		const openEditors = editorService.findEditors(VoidTasksInput.RESOURCE); // should only have 0 or 1 elements...
		if (openEditors.length !== 0) {
			const openEditor = openEditors[0].editor
			const isCurrentlyOpen = editorService.activeEditor?.resource?.fsPath === openEditor.resource?.fsPath
			if (isCurrentlyOpen)
				await editorService.closeEditors(openEditors)
			else
				await editorGroupService.activeGroup.openEditor(openEditor)
			return;
		}

		// else open it
		const input = instantiationService.createInstance(VoidTasksInput);
		await editorGroupService.activeGroup.openEditor(input);
	}
})


// register the "Tasks | Editör" pill into the title bar's left content region
registerTitleBarLeftContentContribution({
	create: (instantiationService) => {
		const control = instantiationService.createInstance(TasksEditorToggleControl);
		return { element: control.element, dispose: () => control.dispose() };
	}
});
