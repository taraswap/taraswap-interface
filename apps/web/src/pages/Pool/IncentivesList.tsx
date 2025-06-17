import { Token } from "@taraswap/sdk-core";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Trans } from "i18n";
import {
  LoadingRows,
  IncentiveCard,
  IncentiveContent,
  IncentiveStatus,
} from "./styled";
import { ThemedText } from "theme/components";
import { RowBetween, RowFixed } from "components/Row";
import CurrencyLogo from "components/Logo/CurrencyLogo";
import { ButtonPrimary } from "components/Button";
import Row from "components/Row";
import { formatEther, getAddress } from "ethers/lib/utils";
import {
  useIncentivesData,
  type ProcessedIncentive,
} from "hooks/useIncentivesData";
import { ScrollBarStyles } from "components/Common";
import styled from "styled-components";
import { useBulkPosition } from "hooks/useBulkPosition";
import Toggle from "components/Toggle";
import { ethers } from "ethers";
import { useAccount } from "hooks/useAccount";

const Container = styled.div`
  height: 425px;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 8px 0;
  width: 100%;
  margin-bottom: 10px;
`;

const IncentivesTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.neutral1};
  
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 20px;
  }
`;

const ButtonsContainer = styled(Row)`
  position: sticky;
  top: 0;
  background: ${({ theme }) => theme.surface1};
  padding: 8px 0 16px 0;
  gap: 8px;
  justify-content: center;
  z-index: 1;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 4px 0 8px 0;
    & > button, & > label, & > div {
      width: 100% !important;
      min-width: 0;
      font-size: 12px !important;
      height: 28px !important;
      padding: 6px !important;
    }
  }
`;

const ScrollableContent = styled.div`
  max-height: calc(100vh - 340px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  ${ScrollBarStyles}
`;

const ToggleLabel = styled.button`
  cursor: pointer;
  background-color: transparent;
  border: none;
  color: ${({ theme }) => theme.accent1};
  font-size: 14px;
  font-weight: 485;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    gap: 8px;
    & > button, & > label, & > div {
      font-size: 12px;
    }
  }
`;

const SmallToggle = styled(Toggle)`
  transform: scale(0.7);
  margin-left: 0;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    transform: scale(0.6);
  }
`;

const StyledCurrencyLogo = styled(CurrencyLogo)`
  margin-right: 8px;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    min-height: 18px !important;
    margin-right: 4px !important;
  }
`;

const IncentiveHeaderRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  min-width: 0;
  gap: 4px;
  padding: 12px;
  font-size: 12px;
  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    gap: 2px;
    font-size: 12px;
  }
`;

const IncentiveHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

function IncentivesList({
  tokenId,
  poolAddress,
}: {
  tokenId: number;
  poolAddress: string;
}) {
  const [expandedIncentive, setExpandedIncentive] = useState<string | null>(
    null
  );
  const [pendingRewardsMap, setPendingRewardsMap] = useState<
    Record<string, number>
  >({});
  const [isClaiming, setIsClaiming] = useState(false);
  const [showEndedIncentives, setShowEndedIncentives] = useState(false);
  const { address } = useAccount();

  const {
    activeIncentives,
    endedIncentives,
    isLoading,
    error,
    refetch: refetchIncentives,
  } = useIncentivesData(poolAddress);
  const allIncentives = showEndedIncentives
    ? [...activeIncentives, ...endedIncentives]
    : activeIncentives;
  const {
    getIncentivePendingRewards,
    handleClaim,
  } = useBulkPosition(tokenId);

  useEffect(() => {
    const fetchRewards = async () => {
      const rewards: Record<string, number> = {};
      for (const incentive of allIncentives) {
        try {
          const reward = await getIncentivePendingRewards(incentive);
          rewards[incentive.id] = Number(reward || 0);
        } catch (error) {
          console.error("Error fetching rewards:", error);
          rewards[incentive.id] = 0;
        }
      }

      setPendingRewardsMap(rewards);
    };

    fetchRewards();
  }, [allIncentives, getIncentivePendingRewards]);


  const handleClaimWithRefresh = useCallback(
    async (pendingRewards: string, incentive: ProcessedIncentive) => {
      try {
        setIsClaiming(true);

        if (!address) {
          throw new Error("No wallet connected");
        }

        // Request user to sign a verification message
        const message = `Verify wallet ownership for claiming ${pendingRewards} rewards at ${new Date().toISOString()}`;
        const hexMessage = `0x${Buffer.from(message, 'utf8').toString('hex')}`;

        const signature = await (window.ethereum as any).request({
          method: 'personal_sign',
          params: [hexMessage, address],
        });

        console.log('Wallet verified with signature:', signature);

        await handleClaim(incentive);
        await refetchIncentives();
      } catch (error) {
        console.error("Error in claim with refresh:", error);
      } finally {
        setIsClaiming(false);
      }
    },
    [handleClaim, refetchIncentives, address]
  );

  if (isLoading) {
    return (
      <Container>
        <LoadingRows>
          <div />
          <div />
          <div />
        </LoadingRows>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ThemedText.DeprecatedMain>
          Error loading incentives: {error.message}
        </ThemedText.DeprecatedMain>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderContainer>
        <IncentivesTitle>
          <Trans i18nKey="common.incentives" />
        </IncentivesTitle>

        <ToggleRow>
          <ToggleLabel as="label">
            <ThemedText.BodySmall color="neutral2">
              <Trans i18nKey="common.showEndedIncentives" />
            </ThemedText.BodySmall>
          </ToggleLabel>
          <SmallToggle
            isActive={showEndedIncentives}
            toggle={() => setShowEndedIncentives(!showEndedIncentives)}
          />
        </ToggleRow>
      </HeaderContainer>

      <ScrollableContent>
        {allIncentives.map((incentive) => {
          const isExpanded = expandedIncentive === incentive.id;
          const isActive = incentive.status === "active";
          const hasStaked = incentive.positionOnIncentiveIds?.includes(
            Number(tokenId)
          );

          const rewardToken = new Token(
            1,
            incentive.rewardToken.id,
            incentive.rewardToken.decimals,
            incentive.rewardToken.symbol
          );

          const logoURI = `https://cdn.jsdelivr.net/gh/taraswap/assets@main/logos/${getAddress(
            rewardToken.address
          )}/logo.png`;

          const pendingRewards = pendingRewardsMap[incentive.id] || 0;
          console.log('pendingRewardsMap', pendingRewardsMap)
          console.log('pendingRewards', pendingRewards)
          return (
            <IncentiveCard
              key={incentive.id}
              onClick={() =>
                setExpandedIncentive(isExpanded ? null : incentive.id)
              }
            >
              <IncentiveHeaderContainer>
                <IncentiveHeaderRow>
                  <StyledCurrencyLogo
                    currency={rewardToken}
                    size={24}
                    style={{ marginRight: "8px" }}
                    logoURI={logoURI}
                  />
                  <ThemedText.DeprecatedMain>
                    {incentive.reward} {rewardToken.symbol} Rewards
                  </ThemedText.DeprecatedMain>
                  {hasStaked && (
                    <ThemedText.DeprecatedMain
                      style={{ marginLeft: "8px", fontSize: "14px" }}
                    >
                      (Staked)
                    </ThemedText.DeprecatedMain>
                  )}
                </IncentiveHeaderRow>
                <IncentiveStatus isActive={isActive}>
                  {isActive ? (
                    <Trans i18nKey="common.active" />
                  ) : incentive.status === "inactive" ? (
                    <Trans i18nKey="common.inactive" />
                  ) : (
                    <Trans i18nKey="common.ended" />
                  )}
                </IncentiveStatus>
              </IncentiveHeaderContainer>
              {isExpanded && (
                <IncentiveContent>
                  <RowBetween>
                    <ThemedText.DeprecatedMain>
                      <Trans i18nKey="common.pendingRewards" />
                    </ThemedText.DeprecatedMain>
                    <RowFixed>
                      <StyledCurrencyLogo
                        currency={rewardToken}
                        size={20}
                        style={{ marginRight: "8px" }}
                        logoURI={logoURI}
                      />
                      <ThemedText.DeprecatedMain>
                        {pendingRewards.toFixed(6)} &nbsp;
                        {rewardToken.symbol}
                      </ThemedText.DeprecatedMain>
                    </RowFixed>
                  </RowBetween>

                  <Row style={{ justifyContent: 'center' }}>
                    <ButtonPrimary
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaimWithRefresh(pendingRewards.toFixed(6), incentive);
                      }}
                      disabled={
                        Number(pendingRewards) <= 0 ||
                        isClaiming ||
                        isNaN(Number(pendingRewards))
                      }
                      style={{
                        padding: "8px",
                        fontSize: "14px",
                        height: "32px",
                        width: "120px",
                      }}
                    >
                      {isClaiming ? (
                        <Trans i18nKey="common.claiming" />
                      ) : (
                        <Trans i18nKey="common.claim" />
                      )}
                    </ButtonPrimary>
                  </Row>
                </IncentiveContent>
              )}
            </IncentiveCard>
          );
        })}
      </ScrollableContent>
    </Container>
  );
}

export default IncentivesList;
