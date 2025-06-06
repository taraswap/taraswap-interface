import React, { useMemo, useEffect } from "react";
import styled from "styled-components";
import { FeeDistributionBar } from "./FeeDistributionBar";
import { MouseoverTooltip } from "components/Tooltip";
import { useFormatter } from "utils/formatNumbers";
import { NumberType } from "utils/formatNumbers";
import DonutChart from "components/DonutChart";

interface PoolFeeDetailsProps {
  incentiveId: string;
  rewardTokenImage: string;
  rewardTokenSymbol: string;
  rewardTokenAddress: string;
  tradeFeesPercentage: number;
  tokenRewardsPercentage: number;
  daily24hAPR: number;
  weeklyRewards: number;
  weeklyRewardsUSD: number;
  endsAt: Date;
}

const Container = styled.div`
  padding-top: 0;
  display: flex;
  justify-content: flex-end;
  width: 100%;
`;

const TooltipContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  min-width: 240px;
  border-radius: 12px;
`;

const TooltipHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TooltipTitle = styled.div`
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
  font-weight: 400;
`;

const TooltipValue = styled.div`
  color: ${({ theme }) => theme.neutral1};
  font-size: 24px;
  font-weight: 500;
`;

const ChartSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const LegendContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const LegendItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LegendLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
`;

const LegendDot = styled.div<{ color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${({ color }) => color};
`;

const LegendValue = styled.div`
  color: ${({ theme }) => theme.neutral1};
  font-size: 14px;
  font-weight: 500;
`;

const WeeklyRewards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const WeeklyRewardsTitle = styled.div`
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
`;

const WeeklyRewardsValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.neutral1};
  font-size: 14px;
`;

const TokenIcon = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const FullWidthDistributionBar = styled.div`
  width: 100%;
  display: flex;
  justify-content: flex-end;
`;

const PoolFeeDetailsContent: React.FC<PoolFeeDetailsProps> = React.memo(
  ({
    rewardTokenImage,
    rewardTokenSymbol,
    rewardTokenAddress,
    tradeFeesPercentage,
    tokenRewardsPercentage,
    daily24hAPR,
    weeklyRewards,
    weeklyRewardsUSD,
    incentiveId,
    endsAt,
  }) => {
    const { formatDelta, formatNumber } = useFormatter();
    const chartData = useMemo(() => {
      return [
        {
          value: tradeFeesPercentage,
          color: "#FFFFFF",
        },
        {
          value: tokenRewardsPercentage,
          color: "#40B66B",
        },
      ];
    }, [tradeFeesPercentage, tokenRewardsPercentage, incentiveId]);

    const formattedDailyAPR = useMemo(() => {
      return formatDelta(daily24hAPR);
    }, [daily24hAPR, formatDelta, incentiveId]);

    const formattedWeeklyRewards = useMemo(() => {
      return formatNumber({
        input: weeklyRewards,
        type: NumberType.TokenNonTx,
      });
    }, [weeklyRewards, formatNumber, incentiveId]);

    const formattedWeeklyRewardsUSD = useMemo(() => {
      return formatNumber({
        input: weeklyRewardsUSD,
        type: NumberType.FiatTokenPrice,
      });
    }, [weeklyRewardsUSD, formatNumber, incentiveId]);

    const tooltipContent = useMemo(() => {
      return (
        <TooltipContent>
          <TooltipHeader>
            <TooltipTitle>24H APR</TooltipTitle>
            <TooltipValue>{formattedDailyAPR}</TooltipValue>
          </TooltipHeader>
          <ChartSection>
            <DonutChart data={chartData} size={120} thickness={16} />
            <LegendContainer>
              <LegendItem>
                <LegendLabel>
                  <LegendDot color="#FFFFFF" />
                  Trade fees
                </LegendLabel>
                <LegendValue>
                  {formatDelta((tradeFeesPercentage * daily24hAPR) / 100)}
                </LegendValue>
              </LegendItem>
              <LegendItem>
                <LegendLabel>
                  <LegendDot color="#40B66B" />
                  {rewardTokenSymbol}
                </LegendLabel>
                <LegendValue>
                  {formatDelta((tokenRewardsPercentage * daily24hAPR) / 100)}
                </LegendValue>
              </LegendItem>
            </LegendContainer>
          </ChartSection>
          <WeeklyRewards>
            <WeeklyRewardsTitle>Weekly Rewards</WeeklyRewardsTitle>
            <WeeklyRewardsValue>
              <TokenIcon src={rewardTokenImage} alt={rewardTokenSymbol} />
              {formattedWeeklyRewards} {rewardTokenSymbol} (
              {formattedWeeklyRewardsUSD})
            </WeeklyRewardsValue>
          </WeeklyRewards>
          <WeeklyRewards>
            <WeeklyRewardsTitle>Ends at</WeeklyRewardsTitle>
            <WeeklyRewardsValue>{endsAt.toLocaleString()}</WeeklyRewardsValue>
          </WeeklyRewards>
        </TooltipContent>
      );
    }, [
      formattedDailyAPR,
      chartData,
      tradeFeesPercentage,
      tokenRewardsPercentage,
      daily24hAPR,
      rewardTokenSymbol,
      rewardTokenImage,
      formattedWeeklyRewards,
      formattedWeeklyRewardsUSD,
      formatDelta,
      incentiveId,
      endsAt,
    ]);

    return (
      <MouseoverTooltip text={tooltipContent} placement="top">
        <Container>
          <FullWidthDistributionBar>
            <FeeDistributionBar
              tradeFeesPercentage={tradeFeesPercentage}
              tokenRewardsPercentage={tokenRewardsPercentage}
              daily24hAPR={daily24hAPR}
              rewardTokenImage={rewardTokenImage}
              rewardTokenSymbol={rewardTokenSymbol}
              rewardTokenAddress={rewardTokenAddress}
            />
          </FullWidthDistributionBar>
        </Container>
      </MouseoverTooltip>
    );
  }
);

export const PoolFeeDetails = React.memo(PoolFeeDetailsContent);
