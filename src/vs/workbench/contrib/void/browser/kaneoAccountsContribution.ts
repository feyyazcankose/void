/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IContextKey, IContextKeyService, RawContextKey, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { AuthenticationSession, AuthenticationSessionsChangeEvent, IAuthenticationProvider, IAuthenticationProviderSessionOptions, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IKaneoAuthService, KaneoAuthState } from '../common/kaneoAuthService.js';

export const KANEO_LOGGED_IN_CONTEXT = new RawContextKey<boolean>('kaneo.loggedIn', false);

const MAUSE_AUTH_PROVIDER_ID = 'mause';
const MAUSE_SESSION_ID = 'mause-session';
const MAUSE_ACCOUNT_ID = 'mause-user';

const MAUSE_LOGOUT_ACTION_ID = 'mause.accounts.logout';
const MAUSE_USER_NAME_COMMAND_ID = 'mause.accounts.userName';

class MauseAuthenticationProvider implements IAuthenticationProvider {
	readonly id = MAUSE_AUTH_PROVIDER_ID;
	readonly label = 'mause';
	readonly supportsMultipleAccounts = false;

	private readonly _onDidChangeSessions = new Emitter<AuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private _session: AuthenticationSession | undefined;

	constructor(private readonly _kaneoAuth: IKaneoAuthService) { }

	updateFromAuthState(state: KaneoAuthState): void {
		const previous = this._session;
		if (state.loggedIn) {
			const next: AuthenticationSession = {
				id: MAUSE_SESSION_ID,
				accessToken: '',
				account: {
					id: MAUSE_ACCOUNT_ID,
					label: state.userName || 'mause',
				},
				scopes: [],
			};
			this._session = next;
			if (!previous) {
				this._onDidChangeSessions.fire({ added: [next], removed: undefined, changed: undefined });
			} else if (previous.account.label !== next.account.label) {
				this._onDidChangeSessions.fire({ added: undefined, removed: undefined, changed: [next] });
			}
		} else if (previous) {
			this._session = undefined;
			this._onDidChangeSessions.fire({ added: undefined, removed: [previous], changed: undefined });
		}
	}

	async getSessions(_scopes: string[] | undefined, _options: IAuthenticationProviderSessionOptions): Promise<readonly AuthenticationSession[]> {
		return this._session ? [this._session] : [];
	}

	async createSession(_scopes: string[], _options: IAuthenticationProviderSessionOptions): Promise<AuthenticationSession> {
		throw new Error(localize('mauseSignInViaTasks', "Sign in from the Tasks pane."));
	}

	async removeSession(_sessionId: string): Promise<void> {
		await this._kaneoAuth.logout();
	}

	dispose(): void {
		this._onDidChangeSessions.dispose();
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: MAUSE_LOGOUT_ACTION_ID,
			title: localize2('mauseLogout', 'Çıkış Yap'),
			f1: false,
			menu: {
				id: MenuId.AccountsContext,
				group: '1_mause',
				order: 2,
				when: KANEO_LOGGED_IN_CONTEXT.isEqualTo(true),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IKaneoAuthService).logout();
	}
});

export class KaneoAccountsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kaneoAccounts';

	private readonly _loggedInContext: IContextKey<boolean>;
	private readonly _userNameMenu = this._register(new MutableDisposable());
	private readonly _provider: MauseAuthenticationProvider;

	constructor(
		@IKaneoAuthService private readonly _kaneoAuth: IKaneoAuthService,
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		this._loggedInContext = KANEO_LOGGED_IN_CONTEXT.bindTo(contextKeyService);
		this._provider = new MauseAuthenticationProvider(this._kaneoAuth);
		this._register({ dispose: () => this._provider.dispose() });

		this._authenticationService.registerAuthenticationProvider(MAUSE_AUTH_PROVIDER_ID, this._provider);
		this._register({
			dispose: () => this._authenticationService.unregisterAuthenticationProvider(MAUSE_AUTH_PROVIDER_ID),
		});

		this._register(this._kaneoAuth.onDidChangeAuthState(state => this._applyAuthState(state)));
		void this._kaneoAuth.getAuthState().then(state => this._applyAuthState(state));
	}

	private _applyAuthState(state: KaneoAuthState): void {
		this._loggedInContext.set(state.loggedIn);
		this._provider.updateFromAuthState(state);
		this._updateUserNameMenuItem(state);
	}

	private _updateUserNameMenuItem(state: KaneoAuthState): void {
		this._userNameMenu.clear();
		if (!state.loggedIn) {
			return;
		}
		const store = new DisposableStore();
		this._userNameMenu.value = store;
		store.add(MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
			group: '1_mause',
			order: 1,
			command: {
				id: MAUSE_USER_NAME_COMMAND_ID,
				title: state.userName || localize('mauseAccount', "mause"),
				precondition: ContextKeyExpr.false(),
			},
		}));
	}
}

registerWorkbenchContribution2(KaneoAccountsContribution.ID, KaneoAccountsContribution, WorkbenchPhase.AfterRestored);
