/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react'
import { useAccessor } from '../util/services.js'

type Step = 'form' | 'requesting' | 'waiting' | 'error'

// Device-authorization sign-in for the Tasks pane. Shown by Tasks.tsx in place of the
// board when IKaneoAuthService reports the user isn't signed in yet. Renderer drives the
// poll loop itself (setTimeout between calls) - kaneoAuthMainService.ts only exposes one
// poll attempt at a time, see kaneoAuthService.ts.
export const KaneoSignIn = ({ initialBaseUrl, onSignedIn }: { initialBaseUrl: string, onSignedIn: () => void }) => {
	const accessor = useAccessor()
	const kaneoAuth = accessor.get('IKaneoAuthService')

	const [baseUrl, setBaseUrl] = useState(initialBaseUrl)
	const [step, setStep] = useState<Step>('form')
	const [userCode, setUserCode] = useState('')
	const [verificationUri, setVerificationUri] = useState('')
	const [errorMessage, setErrorMessage] = useState('')

	const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const cancelledRef = useRef(false)

	useEffect(() => {
		cancelledRef.current = false
		return () => {
			cancelledRef.current = true
			if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
		}
	}, [])

	const pollOnce = async (deviceCode: string, intervalSec: number) => {
		if (cancelledRef.current) return
		const result = await kaneoAuth.pollDeviceToken(deviceCode)
		if (cancelledRef.current) return

		if (result.status === 'complete') {
			onSignedIn()
			return
		}
		if (result.status === 'pending') {
			pollTimeoutRef.current = setTimeout(() => pollOnce(deviceCode, intervalSec), intervalSec * 1000)
			return
		}
		if (result.status === 'denied') {
			setStep('error')
			setErrorMessage('Sign-in request was denied.')
			return
		}
		if (result.status === 'expired') {
			setStep('error')
			setErrorMessage('Code expired. Please try again.')
			return
		}
		setStep('error')
		setErrorMessage(result.message)
	}

	const startSignIn = async () => {
		setStep('requesting')
		setErrorMessage('')
		try {
			await kaneoAuth.setBaseUrl(baseUrl)
			const code = await kaneoAuth.requestDeviceCode()
			if (cancelledRef.current) return
			setUserCode(code.userCode)
			setVerificationUri(code.verificationUriComplete || code.verificationUri)
			setStep('waiting')
			pollTimeoutRef.current = setTimeout(() => pollOnce(code.deviceCode, code.interval), code.interval * 1000)
		} catch (e) {
			setStep('error')
			setErrorMessage(String(e))
		}
	}

	return <div className='flex-1 flex items-center justify-center p-8'>
		<div className='max-w-sm w-full flex flex-col gap-4'>
			<div className='text-lg font-medium text-void-fg-1'>Sign in to Task Management</div>

			{step === 'form' || step === 'requesting' ? <>
				<label className='flex flex-col gap-1.5 text-sm text-void-fg-2'>
					Server URL
					<input
						value={baseUrl}
						onChange={e => setBaseUrl(e.target.value)}
						placeholder='http://localhost:1337'
						className='bg-void-bg-1 rounded-lg px-3 py-2 text-sm text-void-fg-1 outline-none'
					/>
				</label>
				<button
					onClick={startSignIn}
					disabled={step === 'requesting' || !baseUrl.trim()}
					className='bg-void-bg-1 hover:bg-void-bg-1-alt rounded-lg px-4 py-2 text-sm text-void-fg-1 disabled:opacity-50'
				>
					{step === 'requesting' ? 'Connecting...' : 'Sign in'}
				</button>
			</> : null}

			{step === 'waiting' ? <div className='flex flex-col gap-3 text-sm text-void-fg-2'>
				<div>Open this URL and approve the code:</div>
				<div className='text-2xl font-mono tracking-widest text-void-fg-1 bg-void-bg-1 rounded-lg px-4 py-3 text-center'>{userCode}</div>
				{verificationUri ? <a href={verificationUri} target='_blank' rel='noreferrer' className='text-void-fg-1 underline break-all'>{verificationUri}</a> : null}
				<div className='text-void-fg-3'>This window will continue automatically after approval...</div>
			</div> : null}

			{step === 'error' ? <div className='flex flex-col gap-3 text-sm'>
				<div className='text-red-400'>{errorMessage}</div>
				<button onClick={() => setStep('form')} className='bg-void-bg-1 hover:bg-void-bg-1-alt rounded-lg px-4 py-2 text-sm text-void-fg-1 self-start'>Try again</button>
			</div> : null}
		</div>
	</div>
}
