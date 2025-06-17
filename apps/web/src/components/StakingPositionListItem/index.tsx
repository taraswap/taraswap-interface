import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { useCurrency } from 'hooks/Tokens'
import { getAddress } from 'viem'
import { Percent } from '@uniswap/sdk-core'
import { Trans } from 'i18n'
import { Link } from 'react-router-dom'
import { ThemedText } from 'theme/components'
import { DoubleCurrencyLogo } from 'components/DoubleLogo'
import { useFormatter } from 'utils/formatNumbers'
import { useBulkPosition } from 'hooks/useBulkPosition'
import { PositionDetails } from 'types/position'

const LinkRow = styled(Link)`
  align-items: center;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  text-decoration: none;
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToSmall`
    flex-direction: column;
    row-gap: 12px;
    width: 100%;
  `};
`

const RowBetween = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`

const PrimaryPositionIdData = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  > * {
    margin-right: 8px;
  }
`

const FeeTierText = styled(ThemedText.SubHeader)`
  margin-left: 8px !important;
  line-height: 12px;
  color: ${({ theme }) => theme.neutral3};
`

export default function StakingPositionListItem({ position }: { position: PositionDetails & { incentiveData: any } }) {
  const positionSummaryLink = `/pool/${position.tokenId.toString()}`
  const currency0 = useCurrency(getAddress(position.token0 ?? ''))
  const currency1 = useCurrency(getAddress(position.token1 ?? ''))
  const { formatDelta } = useFormatter()
  const [pendingReward, setPendingReward] = useState<number>(0)
  const { getIncentivePendingRewards } = useBulkPosition(Number(position.tokenId.toString()))

  useEffect(() => {
    const fetchRewards = async () => {
      if (position.incentiveData) {
        const rewards = await getIncentivePendingRewards({
          id: position.incentiveData.incentiveId,
          rewardToken: {
            id: position.token1 ?? '',
            symbol: currency1?.symbol ?? '',
            decimals: currency1?.decimals ?? 0,
            logoURI: ''
          },
          poolAddress: position.incentiveData.poolAddress,
          startTime: position.incentiveData.startTime,
          endTime: position.incentiveData.endTime,
          vestingPeriod: position.incentiveData.vestingPeriod,
          refundee: position.incentiveData.refundee
        })
        console.log('rewards', rewards)
        setPendingReward(Number(rewards || 0))
      }
    }
    fetchRewards()
    const interval = setInterval(fetchRewards, 10000)
    return () => clearInterval(interval)
  }, [getIncentivePendingRewards, position.incentiveData])

  return (
    <LinkRow to={positionSummaryLink}>
      <RowBetween>
        <PrimaryPositionIdData>
          <DoubleCurrencyLogo currencies={[currency0, currency1]} size={18} />
          <ThemedText.SubHeader>
            {currency0?.symbol} / {currency1?.symbol}
          </ThemedText.SubHeader>
          <FeeTierText> {formatDelta(parseFloat(new Percent(position.fee, 1_000_000).toSignificant()))}</FeeTierText>
        </PrimaryPositionIdData>
        <ThemedText.BodyPrimary>
          <Trans i18nKey="common.pendingRewards" />: {pendingReward.toFixed(6)} &nbsp;
          {position.incentiveData?.rewardToken?.symbol || currency1?.symbol}
        </ThemedText.BodyPrimary>
      </RowBetween>
    </LinkRow>
  )
} 