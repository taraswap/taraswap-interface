import { BigNumber } from '@ethersproject/bignumber'
import type { Web3Provider } from '@ethersproject/providers'
import { parseEther } from '@ethersproject/units'
import { useWeb3React } from '@web3-react/core'
import { useAccount } from 'hooks/useAccount'
import { useNativeCurrencyBalances } from 'state/connection/hooks'

interface WalletBalanceProps {
  address: string
  balance: string
  weiBalance: BigNumber
  provider?: Web3Provider
}

export function useWalletBalance(): WalletBalanceProps {
  const account = useAccount()
  const { provider } = useWeb3React()
  const balanceString =
    useNativeCurrencyBalances(account.address ? [account.address] : [])?.[account.address ?? '']?.toSignificant(3) ||
    '0'

  return account.address
    ? {
        address: account.address,
        balance: balanceString,
        weiBalance: parseEther(balanceString),
        provider,
      }
    : {
        address: '',
        balance: '0',
        weiBalance: parseEther('0'),
        provider: undefined,
      }
}
