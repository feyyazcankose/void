/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { promisify } from 'util'
import { execFile as _execFile } from 'child_process'
import { IVoidSCMService } from '../common/voidSCMTypes.js'

interface NumStat {
	file: string
	added: number
	removed: number
}

const execFile = promisify(_execFile)

//8000 and 10 were chosen after some experimentation on small-to-moderately sized changes
const MAX_DIFF_LENGTH = 8000
const MAX_DIFF_FILES = 10

const git = async (args: string[], path: string): Promise<string> => {
	const { stdout, stderr } = await execFile('git', args, { cwd: path, maxBuffer: 10 * 1024 * 1024 })
	// git often writes informational messages to stderr even on success
	if (stderr && !stdout && /fatal:|error:/i.test(stderr)) {
		throw new Error(stderr)
	}
	return stdout.trim()
}

const getNumStat = async (path: string, useStagedChanges: boolean): Promise<NumStat[]> => {
	const staged = useStagedChanges ? ['--staged'] : []
	const output = await git(['diff', '--numstat', ...staged], path)
	return output
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [added, removed, file] = line.split('\t')
			return {
				file,
				added: parseInt(added, 10) || 0,
				removed: parseInt(removed, 10) || 0,
			}
		})
}

const getSampledDiff = async (file: string, path: string, useStagedChanges: boolean): Promise<string> => {
	const staged = useStagedChanges ? ['--staged'] : []
	const diff = await git(['diff', '--unified=0', '--no-color', ...staged, '--', file], path)
	return diff.slice(0, MAX_DIFF_LENGTH)
}

const hasStagedChanges = async (path: string): Promise<boolean> => {
	const output = await git(['diff', '--staged', '--name-only'], path)
	return output.length > 0
}

export class VoidSCMService implements IVoidSCMService {
	readonly _serviceBrand: undefined

	async gitStat(path: string): Promise<string> {
		const useStagedChanges = await hasStagedChanges(path)
		const staged = useStagedChanges ? ['--staged'] : []
		return git(['diff', '--stat', ...staged], path)
	}

	async gitSampledDiffs(path: string): Promise<string> {
		const useStagedChanges = await hasStagedChanges(path)
		const numStatList = await getNumStat(path, useStagedChanges)
		const topFiles = numStatList
			.sort((a, b) => (b.added + b.removed) - (a.added + a.removed))
			.slice(0, MAX_DIFF_FILES)
		const diffs = await Promise.all(topFiles.map(async ({ file }) => ({ file, diff: await getSampledDiff(file, path, useStagedChanges) })))
		return diffs.map(({ file, diff }) => `==== ${file} ====\n${diff}`).join('\n\n')
	}

	gitBranch(path: string): Promise<string> {
		return git(['branch', '--show-current'], path)
	}

	gitLog(path: string): Promise<string> {
		return git(['log', '--pretty=format:%h|%s|%ad', '--date=short', '--no-merges', '-n', '5'], path)
	}

	async gitCreateAndCheckoutBranch(path: string, branchName: string): Promise<string> {
		const name = branchName.trim()
		if (!name || name.includes('..') || name.startsWith('-')) {
			throw new Error(`Invalid branch name: ${branchName}`)
		}

		let exists = false
		try {
			await execFile('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`], { cwd: path })
			exists = true
		} catch {
			exists = false
		}

		if (exists) {
			await execFile('git', ['checkout', name], { cwd: path })
		} else {
			await execFile('git', ['checkout', '-b', name], { cwd: path })
		}
		return name
	}
}
