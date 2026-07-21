/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Kept as a literal string (not imported from voidTaskDetailPane.ts) — that file pulls in
// EditorPane/core VS Code modules that must not get bundled into this React tree. Same
// reasoning as tasksEditorToggleControl.ts's local VOID_TOGGLE_TASKS_ACTION_ID constant.
export const VOID_OPEN_TASK_DETAIL_ACTION_ID = 'workbench.action.openVoidTaskDetail'
export const VOID_TOGGLE_TASKS_ACTION_ID = 'workbench.action.toggleVoidTasks'
/** Keep in sync with `browser/kaneoChatInjection.ts` (React must not import that file). */
export const VOID_TRIGGER_AGENT_FROM_TASK_ACTION_ID = 'void.triggerAgentFromTask'
