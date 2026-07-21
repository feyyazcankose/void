/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

export interface IVoidSCMService {
	readonly _serviceBrand: undefined;
	/**
	 * Get git diff --stat
	 *
	 * @param path Path to the git repository
	 */
	gitStat(path: string): Promise<string>
	/**
	 * Get git diff --stat for the top 10 most significantly changed files according to lines added/removed
	 *
	 * @param path Path to the git repository
	 */
	gitSampledDiffs(path: string): Promise<string>
	/**
	 * Get the current git branch
	 *
	 * @param path Path to the git repository
	 */
	gitBranch(path: string): Promise<string>
	/**
	 * Get the last 5 commits excluding merges
	 *
	 * @param path Path to the git repository
	 */
	gitLog(path: string): Promise<string>
	/**
	 * Create branch if missing, then check it out. Returns the branch name.
	 */
	gitCreateAndCheckoutBranch(path: string, branchName: string): Promise<string>
}

export const IVoidSCMService = createDecorator<IVoidSCMService>('voidSCMService')

class VoidSCMChannelService implements IVoidSCMService {
	readonly _serviceBrand: undefined;
	private readonly scm: IVoidSCMService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		this.scm = ProxyChannel.toService<IVoidSCMService>(mainProcessService.getChannel('void-channel-scm'));
	}

	gitStat: IVoidSCMService['gitStat'] = async (path) => this.scm.gitStat(path);
	gitSampledDiffs: IVoidSCMService['gitSampledDiffs'] = async (path) => this.scm.gitSampledDiffs(path);
	gitBranch: IVoidSCMService['gitBranch'] = async (path) => this.scm.gitBranch(path);
	gitLog: IVoidSCMService['gitLog'] = async (path) => this.scm.gitLog(path);
	gitCreateAndCheckoutBranch: IVoidSCMService['gitCreateAndCheckoutBranch'] = async (path, branchName) =>
		this.scm.gitCreateAndCheckoutBranch(path, branchName);
}

registerSingleton(IVoidSCMService, VoidSCMChannelService, InstantiationType.Delayed);
