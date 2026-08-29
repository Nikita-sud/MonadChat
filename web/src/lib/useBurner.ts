'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PrivateKeyAccount } from 'viem'
import { publicClient } from './chain'
import { ensureBurner, loadNickname, requestFaucet, saveNickname } from './wallet'

/**
 * Кошелёк, который приложение создаёт само. Зритель не ставит расширений:
 * зашёл на страницу — ключ уже сгенерирован, нажал «Получить MON» — может писать.
 */
export function useBurner(pollMs = 8000) {
  const [account, setAccount] = useState<PrivateKeyAccount | null>(null)
  const [balance, setBalance] = useState<bigint>(0n)
  const [nickname, setNicknameState] = useState('')
  const [funding, setFunding] = useState(false)
  const [faucetError, setFaucetError] = useState<string | null>(null)

  useEffect(() => {
    const acc = ensureBurner()
    setAccount(acc)
    setNicknameState(loadNickname() || `nad${acc.address.slice(2, 6)}`)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!account) return
    try {
      setBalance(await publicClient.getBalance({ address: account.address }))
    } catch (e) {
      console.error('balance', e)
    }
  }, [account])

  useEffect(() => {
    if (!account) return
    refreshBalance()
    const t = setInterval(refreshBalance, pollMs)
    return () => clearInterval(t)
  }, [account, refreshBalance, pollMs])

  const setNickname = useCallback((n: string) => {
    setNicknameState(n)
    saveNickname(n)
  }, [])

  const fund = useCallback(async () => {
    if (!account) return
    setFunding(true)
    setFaucetError(null)
    try {
      const { txHash } = await requestFaucet(account.address)
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
      await refreshBalance()
    } catch (e) {
      setFaucetError(e instanceof Error ? e.message : 'Кран недоступен')
    } finally {
      setFunding(false)
    }
  }, [account, refreshBalance])

  return { account, balance, refreshBalance, nickname, setNickname, fund, funding, faucetError }
}
