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
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { EditorInputCapabilities, IEditorOpenContext, IUntypedEditorInput } from '../../../common/editor.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

import { mountVoidTaskDetail } from './react/out/task-detail-tsx/index.js'
import { Codicon } from '../../../../base/common/codicons.js';
import { toDisposable, IDisposable } from '../../../../base/common/lifecycle.js';


// resource for a given issue's detail tab — same fake "void" scheme trick as VoidSettingsInput/VoidTasksInput
const resourceForIssue = (issueId: string) => URI.from({ scheme: 'void', path: 'task-detail', query: issueId });

export class VoidTaskDetailInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.taskDetail';

	readonly resource: URI;

	constructor(
		readonly issueId: string,
		private readonly issueTitle: string,
	) {
		super();
		this.resource = resourceForIssue(issueId);
	}

	override get typeId(): string {
		return VoidTaskDetailInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Singleton;
	}

	override getName(): string {
		return this.issueTitle;
	}

	override getIcon() {
		return Codicon.project
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return other instanceof VoidTaskDetailInput && other.issueId === this.issueId;
	}
}


class VoidTaskDetailPane extends EditorPane {
	static readonly ID = 'workbench.void.taskDetailPane';

	private container: HTMLElement | undefined;
	private mountDisposable: IDisposable | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(VoidTaskDetailPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.height = '100%';
		parent.style.width = '100%';

		this.container = document.createElement('div');
		this.container.style.height = '100%';
		this.container.style.width = '100%';

		parent.appendChild(this.container);
	}

	// The pane instance is reused across different issues (same pane ID), so each new
	// input needs to re-mount the React tree with the new issueId — unlike VoidSettingsPane/
	// VoidTasksPane, which only ever have a single possible input.
	override async setInput(input: VoidTaskDetailInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		this.mountDisposable?.dispose();
		this.mountDisposable = undefined;

		if (!this.container) return;

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn = mountVoidTaskDetail(this.container!, accessor, { issueId: input.issueId })?.dispose;
			this.mountDisposable = toDisposable(() => disposeFn?.());
		});
	}

	layout(dimension: Dimension): void {
		// no-op, matches VoidSettingsPane/VoidTasksPane
	}

	override get minimumWidth() { return 900 }

	override dispose(): void {
		this.mountDisposable?.dispose();
		super.dispose();
	}
}

// register Task Detail pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(VoidTaskDetailPane, VoidTaskDetailPane.ID, nls.localize('VoidTaskDetailPane', "Void's Task Detail Pane")),
	[new SyncDescriptor(VoidTaskDetailInput)]
);


// invoked from the Tasks React UI (IssueCard/IssueRow) via commandService.executeCommand —
// opens the issue's detail tab, reusing it if already open (same as the settings/tasks toggle pattern)
export const VOID_OPEN_TASK_DETAIL_ACTION_ID = 'workbench.action.openVoidTaskDetail';
CommandsRegistry.registerCommand(VOID_OPEN_TASK_DETAIL_ACTION_ID, async (accessor, issueId: string, issueTitle: string) => {
	const editorService = accessor.get(IEditorService);
	const editorGroupService = accessor.get(IEditorGroupsService);
	const instantiationService = accessor.get(IInstantiationService);

	const resource = resourceForIssue(issueId);
	const existing = editorService.findEditors(resource);
	if (existing.length > 0) {
		await editorGroupService.activeGroup.openEditor(existing[0].editor);
		return;
	}

	const input = instantiationService.createInstance(VoidTaskDetailInput, issueId, issueTitle);
	await editorGroupService.activeGroup.openEditor(input);
});
