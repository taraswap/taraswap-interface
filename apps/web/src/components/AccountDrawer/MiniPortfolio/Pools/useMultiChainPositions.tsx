import { ChainId, CurrencyAmount, Token, V3_CORE_FACTORY_ADDRESSES } from '@taraswap/sdk-core'
import { Pool, Position, computePoolAddress } from '@taraswap/v3-sdk'
import IUniswapV3PoolStateJSON from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { L1_CHAIN_IDS, L2_CHAIN_IDS, TESTNET_CHAIN_IDS } from 'constants/chains'
import { BigNumber } from 'ethers/lib/ethers'
import { Interface } from 'ethers/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PositionDetails } from 'types/position'
import { NonfungiblePositionManager, UniswapInterfaceMulticall } from 'uniswap/src/abis/types/v3'
import { UniswapV3PoolInterface } from 'uniswap/src/abis/types/v3/UniswapV3Pool'
import { logger } from 'utilities/src/logger/logger'
import { DEFAULT_ERC20_DECIMALS } from 'utilities/src/tokens/constants'
import { currencyKey } from 'utils/currencyKey'
import { PositionInfo, useCachedPositions, useGetCachedTokens, usePoolAddressCache } from './cache'
import { Call, DEFAULT_GAS_LIMIT } from './getTokensAsync'
import { useInterfaceMulticallContracts, usePoolPriceMap, useV3ManagerContracts } from './hooks'

function createPositionInfo(
  owner: string,
  chainId: ChainId,
  details: PositionDetails,
  slot0: any,
  tokenA: Token,
  tokenB: Token
): PositionInfo {
  /* Instantiates a Pool with a hardcoded 0 liqudity value since the sdk only uses this value for swap state and this avoids an RPC fetch */
  const pool = new Pool(tokenA, tokenB, details.fee, slot0.sqrtPriceX96.toString(), 0, slot0.tick)
  const position = new Position({
    pool,
    liquidity: details.liquidity.toString(),
    tickLower: details.tickLower,
    tickUpper: details.tickUpper,
  })
  const inRange = slot0.tick >= details.tickLower && slot0.tick < details.tickUpper
  const closed = details.liquidity.eq(0)
  return { owner, chainId, pool, position, details, inRange, closed }
}

type FeeAmounts = [BigNumber, BigNumber]

const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1)

const DEFAULT_CHAINS = [...L1_CHAIN_IDS, ...L2_CHAIN_IDS].filter((chain: number) => {
  return !TESTNET_CHAIN_IDS.includes(chain)
})

type UseMultiChainPositionsData = { positions?: PositionInfo[]; loading: boolean }

/**
 * Returns all positions for a given account on multiple chains.
 *
 * This hook doesn't use the redux-multicall library to avoid having to manually fetching blocknumbers for each chain.
 *
 * @param account - account to fetch positions for
 * @param chains - chains to fetch positions from
 * @returns positions, fees
 */
export default function useMultiChainPositions(account: string, chains = DEFAULT_CHAINS): UseMultiChainPositionsData {
  const pms = useV3ManagerContracts(chains)
  const multicalls = useInterfaceMulticallContracts(chains)

  const getTokens = useGetCachedTokens(chains)
  const poolAddressCache = usePoolAddressCache()

  const [cachedPositions, setPositions] = useCachedPositions(account)
  const positions = cachedPositions?.result
  const positionsFetching = useRef(false)
  const positionsLoading = !cachedPositions?.result && positionsFetching.current
  
  // Keep stable positions to prevent disappearing during refetches
  const [stablePositions, setStablePositions] = useState<PositionInfo[]>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)
  
  // Update stable positions when we have new data, but only if it's significantly different
  useEffect(() => {
    if (positions && positions.length > 0) {
      const now = Date.now()
      
      // Always update if we have no stable positions
      if (stablePositions.length === 0) {
        setStablePositions(positions)
        setLastUpdateTime(now)
        return
      }
      
      // Check if positions have changed significantly
      const hasSignificantChanges = positions.length !== stablePositions.length ||
        positions.some((pos, index) => {
          const stablePos = stablePositions[index]
          if (!stablePos) return true
          return pos.details.tokenId !== stablePos.details.tokenId ||
                 pos.details.liquidity.toString() !== stablePos.details.liquidity.toString()
        })
      
      // Update if there are significant changes or if it's been more than 30 seconds
      if (hasSignificantChanges || (now - lastUpdateTime) > 30000) {
        setStablePositions(positions)
        setLastUpdateTime(now)
      }
    }
  }, [positions, stablePositions, lastUpdateTime])

  const [feeMap, setFeeMap] = useState<{ [key: string]: FeeAmounts }>({})

  const { priceMap, pricesLoading } = usePoolPriceMap(positions)

  const fetchPositionFees = useCallback(
    async (pm: NonfungiblePositionManager, positionIds: BigNumber[], chainId: number) => {
      const callData = positionIds.map((id) =>
        pm.interface.encodeFunctionData('collect', [
          { tokenId: id, recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 },
        ])
      )
      const fees = (await pm.callStatic.multicall(callData)).reduce((acc, feeBytes, index) => {
        const key = chainId.toString() + positionIds[index]
        acc[key] = pm.interface.decodeFunctionResult('collect', feeBytes) as FeeAmounts
        return acc
      }, {} as { [key: string]: FeeAmounts })

      setFeeMap((prev) => ({ ...prev, ...fees }))
    },
    [account]
  )

  const fetchPositionIds = useCallback(
    async (pm: NonfungiblePositionManager, balance: BigNumber) => {
      const callData = Array.from({ length: balance.toNumber() }, (_, i) =>
        pm.interface.encodeFunctionData('tokenOfOwnerByIndex', [account, i])
      )
      return (await pm.callStatic.multicall(callData)).map((idByte) => BigNumber.from(idByte))
    },
    [account]
  )

  const fetchPositionDetails = useCallback(async (pm: NonfungiblePositionManager, positionIds: BigNumber[]) => {
    const callData = positionIds.map((id) => pm.interface.encodeFunctionData('positions', [id]))
    return (await pm.callStatic.multicall(callData)).map(
      (positionBytes, index) =>
        ({
          ...pm.interface.decodeFunctionResult('positions', positionBytes),
          tokenId: positionIds[index],
        } as unknown as PositionDetails)
    )
  }, [])

  // Combines PositionDetails with Pool data to build our return type
  const fetchPositionInfo = useCallback(
    async (positionDetails: PositionDetails[], chainId: ChainId, multicall: UniswapInterfaceMulticall) => {
      const poolInterface = new Interface(IUniswapV3PoolStateJSON.abi) as UniswapV3PoolInterface
      const tokens = await getTokens(
        positionDetails.flatMap((details) => [details.token0, details.token1]),
        chainId
      )

      const calls: Call[] = []
      const poolPairs: [Token, Token][] = []
      positionDetails.forEach((details) => {
        const tokenA = tokens[details.token0] ?? new Token(chainId, details.token0, DEFAULT_ERC20_DECIMALS)
        const tokenB = tokens[details.token1] ?? new Token(chainId, details.token1, DEFAULT_ERC20_DECIMALS)

        let poolAddress = poolAddressCache.get(details, chainId)
        if (!poolAddress) {
          const factoryAddress = V3_CORE_FACTORY_ADDRESSES[chainId]
          poolAddress = computePoolAddress({ factoryAddress, tokenA, tokenB, fee: details.fee, chainId })
          poolAddressCache.set(details, chainId, poolAddress)
        }
        poolPairs.push([tokenA, tokenB])
        calls.push({
          target: poolAddress,
          callData: poolInterface.encodeFunctionData('slot0'),
          gasLimit: DEFAULT_GAS_LIMIT,
        })
      }, [])

      return (await multicall.callStatic.multicall(calls)).returnData.reduce((acc: PositionInfo[], result, i) => {
        if (result.success) {
          const slot0 = poolInterface.decodeFunctionResult('slot0', result.returnData)
          acc.push(createPositionInfo(account, chainId, positionDetails[i], slot0, ...poolPairs[i]))
        } else {
          logger.debug('useMultiChainPositions', 'fetchPositionInfo', 'slot0 fetch errored', result)
        }
        return acc
      }, [])
    },
    [account, poolAddressCache, getTokens]
  )

  const fetchPositionsForChain = useCallback(
    async (chainId: ChainId): Promise<PositionInfo[]> => {
      if (!account || account.length === 0) {
        return []
      }
      try {
        const pm = pms[chainId]
        const multicall = multicalls[chainId]
        const balance = await pm?.balanceOf(account)
        if (!pm || !multicall || balance.lt(1)) {
          return []
        }

        const positionIds = await fetchPositionIds(pm, balance)
        // Fetches fees in the background and stores them separetely from the results of this function
        fetchPositionFees(pm, positionIds, chainId)

        const postionDetails = await fetchPositionDetails(pm, positionIds)
        return fetchPositionInfo(postionDetails, chainId, multicall)
      } catch (error) {
        const wrappedError = new Error('Failed to fetch positions for chain', { cause: error })
        logger.debug('useMultiChainPositions', 'fetchPositionsForChain', wrappedError.message, {
          error: wrappedError,
          chainId,
        })
        return []
      }
    },
    [account, fetchPositionDetails, fetchPositionFees, fetchPositionIds, fetchPositionInfo, pms, multicalls]
  )

  const fetchAllPositions = useCallback(async () => {
    positionsFetching.current = true
    try {
      const positions = (await Promise.all(chains.map(fetchPositionsForChain))).flat()
      positionsFetching.current = false
      setPositions(positions)
    } catch (error) {
      console.error('Failed to fetch positions:', error)
      positionsFetching.current = false
      // Don't clear existing positions on error - keep the last known good state
    }
  }, [chains, fetchPositionsForChain, setPositions])

  // Background refetching - fetch in background without clearing existing data
  const backgroundRefetch = useCallback(async () => {
    if (positionsFetching.current) return
    
    try {
      positionsFetching.current = true
      const newPositions = (await Promise.all(chains.map(fetchPositionsForChain))).flat()
      positionsFetching.current = false
      
      // Only update if we got new data
      if (newPositions && newPositions.length > 0) {
        setPositions(newPositions)
      }
    } catch (error) {
      console.error('Background refetch failed:', error)
      positionsFetching.current = false
      // Don't clear existing positions on error
    }
  }, [chains, fetchPositionsForChain, setPositions])

  // Fetches positions when existing positions are stale and the document has focus
  useEffect(() => {
    if (cachedPositions?.stale === false) {
      return
    } else if (document.hasFocus()) {
      // Use background refetch to avoid clearing existing data
      backgroundRefetch()
    } else {
      // Avoids refetching positions until the user returns to Interface to avoid polling unnused rpc data
      const onFocus = () => {
        backgroundRefetch()
        window.removeEventListener('focus', onFocus)
      }
      window.addEventListener('focus', onFocus)
      return () => {
        window.removeEventListener('focus', onFocus)
      }
    }
    return
  }, [backgroundRefetch, cachedPositions?.stale])

  // Periodic background refresh every 30 seconds when document has focus
  useEffect(() => {
    if (!account) return
    
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        backgroundRefetch()
      }
    }, 30000) // 30 seconds
    
    return () => clearInterval(interval)
  }, [account, backgroundRefetch])

  const positionsWithFeesAndPrices: PositionInfo[] | undefined = useMemo(
    () =>
      positions?.map((position) => {
        const key = position.chainId.toString() + position.details.tokenId
        const fees = feeMap[key]
          ? [
              // We parse away from SDK/ethers types so fees can be multiplied by primitive number prices
              parseFloat(CurrencyAmount.fromRawAmount(position.pool.token0, feeMap[key]?.[0].toString()).toExact()),
              parseFloat(CurrencyAmount.fromRawAmount(position.pool.token1, feeMap[key]?.[1].toString()).toExact()),
            ]
          : undefined
        const prices = [priceMap[currencyKey(position.pool.token0)], priceMap[currencyKey(position.pool.token1)]]
        return { ...position, fees, prices } as PositionInfo
      }),
    [feeMap, positions, priceMap]
  )

  // Use stable positions to prevent disappearing during refetches
  const finalPositions = stablePositions.length > 0 ? stablePositions : positionsWithFeesAndPrices

  return { positions: finalPositions, loading: pricesLoading || positionsLoading }
}
