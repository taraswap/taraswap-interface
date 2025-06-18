import { useAccount } from "hooks/useAccount";
import { useV3StakerContract } from "hooks/useV3StakerContract";
import { useV3NFTPositionManagerContract } from "hooks/useContract";
import { useCallback, useState, useEffect } from "react";
import { IncentiveKey, RewardInfo } from "hooks/usePosition";
import { ProcessedIncentive } from "hooks/useIncentivesData";
import { ethers } from "ethers";

export const useBulkPosition = (
  tokenId: number,
) => {
  const { address } = useAccount();

  const getIncentivePendingRewards = useCallback(
    async (incentive: ProcessedIncentive | {
      id?: string;
      rewardToken: {
        id: string;
        symbol: string;
        decimals: number;
      };
      poolAddress: string;
      startTime: number;
      endTime: number;
      vestingPeriod: string;
      refundee: string;
    }) => {
      try {
        const response = await fetch(`${process.env.REACT_APP_V3_STAKER_API_URL}/incentives/calculate-rewards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            incentiveId: incentive.id,
            tokenId: tokenId
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch pending rewards: ${response.statusText}`);
        }
        console.log('response', response)

        const data = await response.json();
        return ethers.utils.formatUnits(data.reward, incentive.rewardToken.decimals);
      } catch (error) {
        console.error("Error getting pending rewards:", error);
        return null;
      }
    },
    [tokenId]
  );

  const handleClaim = useCallback(async (incentive: ProcessedIncentive) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_V3_STAKER_API_URL}/incentives/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incentiveId: incentive.id,
          tokenId: tokenId,
          userAddress: address
        }),
      });
      console.log('response', response)

      if (!response.ok) {
        throw new Error(`Failed to claim rewards: ${response.statusText}`);
      }
      return true;
    } catch (error) {
      console.error("Error claiming rewards:", error);
      return false;
    }
  }, [tokenId]);

  return {
    getIncentivePendingRewards,
    handleClaim,
  };
};
