import { BigNumber } from "@ethersproject/bignumber";
import type { TransactionResponse } from "@ethersproject/providers";
import {
  InterfacePageName,
  LiquidityEventName,
  LiquiditySource,
} from "@uniswap/analytics-events";
import {
  ChainId,
  Currency,
  CurrencyAmount,
  Fraction,
  Percent,
  Price,
  Token,
} from "@taraswap/sdk-core";
import { NonfungiblePositionManager, Pool, Position } from "@taraswap/v3-sdk";
import Badge from "components/Badge";
import { ButtonConfirmed, ButtonGray, ButtonPrimary } from "components/Button";
import { DarkCard, LightCard } from "components/Card";
import { AutoColumn } from "components/Column";
import { DoubleCurrencyLogo } from "components/DoubleLogo";
import { LoadingFullscreen } from "components/Loader/styled";
import CurrencyLogo from "components/Logo/CurrencyLogo";
import { RowBetween, RowFixed } from "components/Row";
import Toggle from "components/Toggle";
import TransactionConfirmationModal, {
  ConfirmationModalContent,
} from "components/TransactionConfirmationModal";
import { Dots } from "components/swap/styled";
import {
  SupportedInterfaceChainId,
  chainIdToBackendChain,
  useIsSupportedChainId,
  useSupportedChainId,
} from "constants/chains";
import {
  getPoolDetailsURL,
  getTokenDetailsURL,
  isGqlSupportedChain,
} from "graphql/data/util";
import { useToken } from "hooks/Tokens";
import { useAccount } from "hooks/useAccount";
import { useV3NFTPositionManagerContract } from "hooks/useContract";
import { useEthersSigner } from "hooks/useEthersSigner";
import useIsTickAtLimit from "hooks/useIsTickAtLimit";
import { PoolState, usePool } from "hooks/usePools";
import useStablecoinPrice from "hooks/useStablecoinPrice";
import { useV3PositionFees } from "hooks/useV3PositionFees";
import { useV3PositionFromTokenId } from "hooks/useV3Positions";
import { Trans, t } from "i18n";
import { useSingleCallResult } from "lib/hooks/multicall";
import useNativeCurrency from "lib/hooks/useNativeCurrency";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet-async/lib/index";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Bound } from "state/mint/v3/actions";
import {
  useIsTransactionPending,
  useTransactionAdder,
} from "state/transactions/hooks";
import styled, { useTheme } from "styled-components";
import {
  ClickableStyle,
  ExternalLink,
  HideExtraSmall,
  HideSmall,
  StyledRouterLink,
  ThemedText,
} from "theme/components";
import { Text } from "ui/src";
import Trace from "uniswap/src/features/telemetry/Trace";
import { sendAnalyticsEvent } from "uniswap/src/features/telemetry/send";
import { logger } from "utilities/src/logger/logger";
import { currencyId } from "utils/currencyId";
import { WrongChainError } from "utils/errors";
import { NumberType, useFormatter } from "utils/formatNumbers";
import { unwrappedToken } from "utils/unwrappedToken";
import RangeBadge from "../../components/Badge/RangeBadge";
import { SmallButtonPrimary } from "../../components/Button/index";
import { getPriceOrderingFromPositionForUI } from "../../components/PositionListItem";
import RateToggle from "../../components/RateToggle";
import { SwitchLocaleLink } from "../../components/SwitchLocaleLink";
import { usePositionTokenURI } from "../../hooks/usePositionTokenURI";
import { TransactionType } from "../../state/transactions/types";
import { calculateGasMargin } from "../../utils/calculateGasMargin";
import { ExplorerDataType, getExplorerLink } from "../../utils/getExplorerLink";
import { LoadingRows } from "./styled";
import usePosition from "hooks/usePosition";
import useTokenPosition from "hooks/useTokenPosition";
import { formatEther } from "ethers/lib/utils";
import IncentivesList from "./IncentivesList";

const PositionPageButtonPrimary = styled(ButtonPrimary)`
  width: 228px;
  height: 40px;
  font-size: 16px;
  line-height: 20px;
  border-radius: 12px;
`;

const PageWrapper = styled.div`
  padding: 68px 16px 16px 16px;
  width: 100%;
  max-width: 1400px;
  display: flex;
  gap: 12px;
  margin: 0 auto;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;

  & > * {
    box-sizing: border-box;
  }

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.md}px`}) {
    padding: 16px;
    flex-direction: column;
  }

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.sm}px`}) {
    padding: 16px;
    flex-direction: column;
  }
`;

const LeftPane = styled.div`
  flex: 1;
  min-width: 0;
  max-width: 65%;
  overflow: hidden;
  width: 100%;

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.md}px`}) {
    max-width: 100%;
    width: 100%;
  }
`;

const RightPane = styled.div`
  flex: 0 0 40%;
  min-width: 350px;
  max-width: 40%;
  overflow: hidden;
  width: 100%;
  padding-top: 7%;

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.md}px`}) {
    max-width: 100%;
    width: 100%;
    min-width: 0;
    padding-top: 0;
  }
`;

const DarkCardWithOverflow = styled(DarkCard)`
  overflow: hidden;
  width: 100%;
  max-width: 100%;
`;

const BadgeText = styled.div`
  font-weight: 535;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`;

// responsive text
// disable the warning because we don't use the end prop, we just want to filter it out
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Label = styled(({ end, ...props }) => (
  <ThemedText.DeprecatedLabel {...props} />
))<{ end?: boolean }>`
  display: flex;
  font-size: 16px;
  justify-content: ${({ end }) => (end ? "flex-end" : "flex-start")};
  align-items: center;
`;

const ExtentsText = styled.span`
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
  text-align: center;
  margin-right: 4px;
  font-weight: 535;
`;

const HoverText = styled(ThemedText.DeprecatedMain)`
  text-decoration: none;
  color: ${({ theme }) => theme.neutral2};
  :hover {
    color: ${({ theme }) => theme.neutral1};
    text-decoration: none;
  }
`;

const DoubleArrow = styled.span`
  color: ${({ theme }) => theme.neutral3};
  margin: 0 1rem;
`;
const ResponsiveRow = styled(RowBetween)`
  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.sm}px`}) {
    flex-direction: column;
    align-items: flex-start;
    row-gap: 16px;
    width: 100%;
  }
`;

const ActionButtonResponsiveRow = styled(ResponsiveRow)`
  width: 50%;
  justify-content: flex-end;

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.sm}px`}) {
    width: 100%;
    flex-direction: row;
    * {
      width: 100%;
    }
  }
`;

const ResponsiveButtonConfirmed = styled(ButtonConfirmed)`
  border-radius: 12px;
  padding: 6px 8px;
  width: fit-content;
  font-size: 16px;

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.md}px`}) {
    width: fit-content;
  }

  @media only screen and (max-width: ${({ theme }) =>
      `${theme.breakpoint.sm}px`}) {
    width: fit-content;
  }
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template: "overlap";
  min-height: 400px;
`;

const NFTCanvas = styled.canvas`
  grid-area: overlap;
`;

const NFTImage = styled.img`
  grid-area: overlap;
  height: 400px;
  /* Ensures SVG appears on top of canvas. */
  z-index: 1;
`;

const StyledPoolLink = styled(Link)`
  text-decoration: none;
  ${ClickableStyle}
`;

const PairHeader = styled(ThemedText.H1Medium)`
  margin-right: 10px;
`;

function UserDetailsCard(props: { tokenId: number; incentiveId: string }) {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState({
    hasDeposited: false,
    hasStaked: false,
    pendingRewards: BigNumber.from(0),
  });
  const [lpTokenStaked, setLpTokenStaked] = useState(false);

  const [isApproved, setIsApproved] = useState(false);
  const [accruedRewards, setAccruedRewards] = useState<BigNumber>(
    BigNumber.from(0)
  );
  const [refetch, setRefetch] = useState(1);

  const formattedPendingRewards = useMemo(
    () => Number(formatEther(userDetails.pendingRewards)).toFixed(4),
    [userDetails.pendingRewards]
  );

  const {
    incentive,
    getRewardInfo,
    getAccruedRewards,
    approve,
    transfer,
    withdrawPosition,
    stakePosition,
    unstakePosition,
    claim,
    endIncentive,
    isDeposited,
    isApprovedForTransfer,
    isFetchingRewardInfo,
    isApproving,
    isTransferring,
    isStaking,
    isUnstaking,
    isClaiming,
    isWithdrawing,
    isEndingIncentive,
  } = usePosition(props.tokenId, props.incentiveId);

  const getAccruedRewardsCallback = useCallback(async () => {
    return await getAccruedRewards();
  }, [getAccruedRewards]);

  useEffect(() => {
    getAccruedRewardsCallback().then((rewards) => {
      setAccruedRewards(rewards ?? BigNumber.from(0));
      setRefetch((prev) => prev + 1);
    });
  }, [getAccruedRewardsCallback, userDetails.hasStaked, isClaiming]);

  const formattedAccruedRewards = useMemo(
    () => Number(formatEther(accruedRewards)).toFixed(4),
    [accruedRewards]
  );

  const { getDepositData, isLoading: isLoadingDepositData } = useTokenPosition(
    props.tokenId
  );

  const fetchDepositAndRewards = async () => {
    const depositData = await getDepositData();
    const hasDeposited = await isDeposited();
    let pendingRewards = BigNumber.from(0);
    const hasStakes = depositData?.numberOfStakes ?? 0 > 0;
    setLpTokenStaked(hasStakes ? true : false);
    let hasStaked = false;
    const rewardInfo = await getRewardInfo();
    if (rewardInfo === undefined) {
      hasStaked = false;
    } else {
      pendingRewards = rewardInfo?.reward ?? BigNumber.from(0);
      hasStaked = true;
    }
    return { hasDeposited, pendingRewards, hasStaked };
  };

  useEffect(() => {
    isApprovedForTransfer().then((isApproved) => {
      setIsApproved(isApproved);
    });
  }, [isApprovedForTransfer]);

  useEffect(() => {
    fetchDepositAndRewards().then((data) => {
      if (data) {
        setUserDetails(data);
      }
    });
  }, [refetch, incentive]);

  const approveAndTransfer = useCallback(async () => {
    if (isApproved) {
      transfer(() => {
        setRefetch((prev) => prev + 1);
      });
    } else {
      await approve(() => {
        setIsApproved(true);
        transfer(() => {
          setRefetch((prev) => prev + 1);
        });
      });
    }
  }, [approve, transfer, refetch, isApproved]);

  const withdraw = useCallback(async () => {
    await withdrawPosition(() => {
      setRefetch((prev) => prev + 1);
    });
  }, [withdrawPosition, refetch]);

  const unstake = useCallback(async () => {
    await unstakePosition(() => {
      setRefetch((prev) => prev + 1);
    });
  }, [unstakePosition, refetch]);

  const claimReward = useCallback(async () => {
    await claim(() => {
      setRefetch((prev) => prev + 1);
    });
  }, [claim, refetch]);

  const stake = useCallback(async () => {
    await stakePosition(() => {
      setRefetch((prev) => prev + 1);
    });
  }, [stakePosition, refetch]);

  const endIncentiveCallback = useCallback(async () => {
    await endIncentive(() => {
      setRefetch((prev) => prev + 1);
      navigate("/farms");
    });
  }, [endIncentive, refetch, navigate]);

  const incentiveStarted =
    incentive &&
    incentive.startTime &&
    parseInt(incentive.startTime) < Date.now() / 1000;

  return props.incentiveId ? (
    <AutoColumn gap="md" justify="center">
      <RowBetween gap="md">
        <LightCard padding="12px" width="100%">
          <AutoColumn gap="md" justify="center">
            <ExtentsText>
              <Trans i18nKey="common.incentives.hasDeposited" />
            </ExtentsText>
            <ThemedText.DeprecatedMediumHeader textAlign="center">
              {userDetails.hasDeposited ? "Yes" : "No"}
            </ThemedText.DeprecatedMediumHeader>
          </AutoColumn>
        </LightCard>
        <LightCard padding="12px" width="100%">
          <AutoColumn gap="md" justify="center">
            <ExtentsText>
              <Trans i18nKey="common.incentives.pending.reward" />
            </ExtentsText>
            <ThemedText.DeprecatedMediumHeader textAlign="center">
              {formattedPendingRewards} {incentive?.rewardToken.symbol}
            </ThemedText.DeprecatedMediumHeader>
          </AutoColumn>
        </LightCard>
        <LightCard padding="12px" width="100%">
          <AutoColumn gap="md" justify="center">
            <ExtentsText>
              <Trans i18nKey="common.incentives.accrued.reward" />
            </ExtentsText>
            <ThemedText.DeprecatedMediumHeader textAlign="center">
              {formattedAccruedRewards} {incentive?.rewardToken.symbol}
            </ThemedText.DeprecatedMediumHeader>
          </AutoColumn>
        </LightCard>
      </RowBetween>
      {incentive &&
        incentive?.endTime &&
        parseInt(incentive?.endTime) < Date.now() / 1000 && (
          <LightCard padding="12px" width="100%">
            <AutoColumn gap="md" justify="center">
              <ExtentsText>
                <Trans i18nKey="common.incentives.end" />
              </ExtentsText>
              <ButtonPrimary onClick={endIncentiveCallback}>
                {isEndingIncentive ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    style={{ marginRight: "8px" }}
                  >
                    <path
                      fill="currentColor"
                      d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                    >
                      <animateTransform
                        attributeName="transform"
                        dur="0.75s"
                        repeatCount="indefinite"
                        type="rotate"
                        values="0 12 12;360 12 12"
                      />
                    </path>
                  </svg>
                ) : (
                  "End incentive"
                )}
              </ButtonPrimary>
            </AutoColumn>
          </LightCard>
        )}
      <LightCard padding="12px" width="100%">
        <AutoColumn gap="md" justify="center">
          <ExtentsText>
            <Trans i18nKey="common.incentives.lp.deposit" />
          </ExtentsText>
          <ButtonPrimary
            onClick={approveAndTransfer}
            disabled={userDetails.hasDeposited}
          >
            {isApproving || isTransferring ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                style={{ marginRight: "8px" }}
              >
                <path
                  fill="currentColor"
                  d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                >
                  <animateTransform
                    attributeName="transform"
                    dur="0.75s"
                    repeatCount="indefinite"
                    type="rotate"
                    values="0 12 12;360 12 12"
                  />
                </path>
              </svg>
            ) : (
              "Approve and Deposit LP Token"
            )}
          </ButtonPrimary>
          <ButtonPrimary
            onClick={withdraw}
            disabled={!userDetails.hasDeposited || lpTokenStaked}
          >
            {isWithdrawing ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                style={{ marginRight: "8px" }}
              >
                <path
                  fill="currentColor"
                  d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                >
                  <animateTransform
                    attributeName="transform"
                    dur="0.75s"
                    repeatCount="indefinite"
                    type="rotate"
                    values="0 12 12;360 12 12"
                  />
                </path>
              </svg>
            ) : lpTokenStaked ? (
              "LP token is staked. Unstake to withdraw."
            ) : (
              "Withdraw LP Token"
            )}
          </ButtonPrimary>
        </AutoColumn>
      </LightCard>
      <LightCard padding="12px" width="100%">
        <AutoColumn gap="md" justify="center">
          {userDetails.hasDeposited ? (
            <>
              <ExtentsText>
                <Trans i18nKey="common.incentives.lp.stake" />
              </ExtentsText>
              <ButtonPrimary
                onClick={stake}
                disabled={
                  !userDetails.hasDeposited ||
                  userDetails.hasStaked ||
                  !incentiveStarted
                }
              >
                {isStaking ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    style={{ marginRight: "8px" }}
                  >
                    <path
                      fill="currentColor"
                      d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                    >
                      <animateTransform
                        attributeName="transform"
                        dur="0.75s"
                        repeatCount="indefinite"
                        type="rotate"
                        values="0 12 12;360 12 12"
                      />
                    </path>
                  </svg>
                ) : incentiveStarted ? (
                  "Stake"
                ) : (
                  `Incentive starts at ${new Date(
                    Number(incentive?.startTime || 0) * 1000
                  ).toLocaleString()}`
                )}
              </ButtonPrimary>
              <ButtonPrimary
                onClick={claimReward}
                disabled={!userDetails.hasDeposited || accruedRewards.isZero()}
              >
                {isClaiming ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    style={{ marginRight: "8px" }}
                  >
                    <path
                      fill="currentColor"
                      d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                    >
                      <animateTransform
                        attributeName="transform"
                        dur="0.75s"
                        repeatCount="indefinite"
                        type="rotate"
                        values="0 12 12;360 12 12"
                      />
                    </path>
                  </svg>
                ) : (
                  "Claim Reward"
                )}
              </ButtonPrimary>
              <ButtonPrimary
                onClick={unstake}
                disabled={!userDetails.hasStaked}
              >
                {isUnstaking ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    style={{ marginRight: "8px" }}
                  >
                    <path
                      fill="currentColor"
                      d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                    >
                      <animateTransform
                        attributeName="transform"
                        dur="0.75s"
                        repeatCount="indefinite"
                        type="rotate"
                        values="0 12 12;360 12 12"
                      />
                    </path>
                  </svg>
                ) : (
                  "Unstake and claim pending rewards"
                )}
              </ButtonPrimary>
            </>
          ) : (
            <ExtentsText>
              <Trans i18nKey="common.incentives.lp.depositFirst" />
            </ExtentsText>
          )}
        </AutoColumn>
      </LightCard>
    </AutoColumn>
  ) : (
    <></>
  );
}

function CurrentPriceCard({
  inverted,
  pool,
  currencyQuote,
  currencyBase,
}: {
  inverted?: boolean;
  pool?: Pool | null;
  currencyQuote?: Currency;
  currencyBase?: Currency;
}) {
  const { formatPrice } = useFormatter();

  if (!pool || !currencyQuote || !currencyBase) {
    return null;
  }

  return (
    <LightCard padding="12px">
      <AutoColumn gap="sm" justify="center">
        <ExtentsText>
          <Trans i18nKey="common.currentPrice" />
        </ExtentsText>
        <ThemedText.DeprecatedMediumHeader textAlign="center">
          {formatPrice({
            price: inverted ? pool.token1Price : pool.token0Price,
            type: NumberType.TokenTx,
          })}
        </ThemedText.DeprecatedMediumHeader>
        <ExtentsText>
          <Trans
            i18nKey="common.feesEarnedPerBase"
            values={{
              symbolA: currencyQuote?.symbol,
              symbolB: currencyBase?.symbol,
            }}
          />
        </ExtentsText>
      </AutoColumn>
    </LightCard>
  );
}

const TokenLink = ({
  children,
  chainId,
  address,
}: PropsWithChildren<{
  chainId: SupportedInterfaceChainId;
  address: string;
}>) => {
  const tokenLink = getTokenDetailsURL({
    address,
    chain: chainIdToBackendChain({ chainId }),
  });
  return <StyledRouterLink to={tokenLink}>{children}</StyledRouterLink>;
};

const ExternalTokenLink = ({
  children,
  chainId,
  address,
}: PropsWithChildren<{ chainId: number; address: string }>) => {
  return (
    <ExternalLink
      href={getExplorerLink(chainId, address, ExplorerDataType.TOKEN)}
    >
      {children}
    </ExternalLink>
  );
};

function LinkedCurrency({
  chainId,
  currency,
}: {
  chainId: number;
  currency?: Currency;
}) {
  const address = (currency as Token)?.address;
  const supportedChain = useSupportedChainId(chainId);

  const Link = isGqlSupportedChain(supportedChain)
    ? TokenLink
    : ExternalTokenLink;
  return (
    <Link chainId={chainId} address={address}>
      <RowFixed>
        <CurrencyLogo
          currency={currency}
          size={20}
          style={{ marginRight: "0.5rem" }}
        />
        <ThemedText.DeprecatedMain>
          {currency?.symbol} ↗
        </ThemedText.DeprecatedMain>
      </RowFixed>
    </Link>
  );
}

function getRatio(
  lower: Price<Currency, Currency>,
  current: Price<Currency, Currency>,
  upper: Price<Currency, Currency>
) {
  try {
    if (!current.greaterThan(lower)) {
      return 100;
    } else if (!current.lessThan(upper)) {
      return 0;
    }

    const a = Number.parseFloat(lower.toSignificant(15));
    const b = Number.parseFloat(upper.toSignificant(15));
    const c = Number.parseFloat(current.toSignificant(15));

    const ratio = Math.floor(
      (1 /
        ((Math.sqrt(a * b) - Math.sqrt(b * c)) / (c - Math.sqrt(b * c)) + 1)) *
        100
    );

    if (ratio < 0 || ratio > 100) {
      throw Error("Out of range");
    }

    return ratio;
  } catch {
    return undefined;
  }
}

// snapshots a src img into a canvas
function getSnapshot(
  src: HTMLImageElement,
  canvas: HTMLCanvasElement,
  targetHeight: number
) {
  const context = canvas.getContext("2d");

  if (context) {
    let { width, height } = src;

    // src may be hidden and not have the target dimensions
    const ratio = width / height;
    height = targetHeight;
    width = Math.round(ratio * targetHeight);

    // Ensure crispness at high DPIs
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.scale(devicePixelRatio, devicePixelRatio);

    context.clearRect(0, 0, width, height);
    context.drawImage(src, 0, 0, width, height);
  }
}

function NFT({
  image,
  height: targetHeight,
}: {
  image: string;
  height: number;
}) {
  const [animate, setAnimate] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  return (
    <NFTGrid
      onMouseEnter={() => {
        setAnimate(true);
      }}
      onMouseLeave={() => {
        // snapshot the current frame so the transition to the canvas is smooth
        if (imageRef.current && canvasRef.current) {
          getSnapshot(imageRef.current, canvasRef.current, targetHeight);
        }
        setAnimate(false);
      }}
    >
      <NFTCanvas ref={canvasRef} />
      <NFTImage
        ref={imageRef}
        src={image}
        hidden={!animate}
        onLoad={() => {
          // snapshot for the canvas
          if (imageRef.current && canvasRef.current) {
            getSnapshot(imageRef.current, canvasRef.current, targetHeight);
          }
        }}
      />
    </NFTGrid>
  );
}

const useInverter = ({
  priceLower,
  priceUpper,
  quote,
  base,
  invert,
}: {
  priceLower?: Price<Token, Token>;
  priceUpper?: Price<Token, Token>;
  quote?: Token;
  base?: Token;
  invert?: boolean;
}): {
  priceLower?: Price<Token, Token>;
  priceUpper?: Price<Token, Token>;
  quote?: Token;
  base?: Token;
} => {
  return {
    priceUpper: invert ? priceLower?.invert() : priceUpper,
    priceLower: invert ? priceUpper?.invert() : priceLower,
    quote: invert ? base : quote,
    base: invert ? quote : base,
  };
};

export function PositionPageUnsupportedContent() {
  return (
    <PageWrapper>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <ThemedText.HeadlineLarge style={{ marginBottom: "8px" }}>
          <Trans i18nKey="common.positionUnavailable">
            Position unavailable
          </Trans>
        </ThemedText.HeadlineLarge>
        <ThemedText.BodyPrimary style={{ marginBottom: "32px" }}>
          <Trans i18nKey="pool.position.networkConnect" />
        </ThemedText.BodyPrimary>
        <PositionPageButtonPrimary as={Link} to="/pool" width="fit-content">
          <Trans i18nKey="pool.back" />
        </PositionPageButtonPrimary>
      </div>
    </PageWrapper>
  );
}

export default function PositionPage() {
  const { chainId } = useAccount();
  const isSupportedChain = useIsSupportedChainId(chainId);
  if (isSupportedChain) {
    return <PositionPageContent />;
  } else {
    return <PositionPageUnsupportedContent />;
  }
}

const PositionLabelRow = styled(RowFixed)({
  flexWrap: "wrap",
  gap: 8,
});

function parseTokenId(tokenId: string | undefined): BigNumber | undefined {
  if (!tokenId) {
    return;
  }
  try {
    return BigNumber.from(tokenId);
  } catch (error) {
    return;
  }
}

function PositionPageContent() {
  const { tokenId: tokenIdFromUrl } = useParams<{ tokenId?: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const incentiveId = queryParams.get("incentive");
  const account = useAccount();
  const supportedChain = useSupportedChainId(account.chainId);
  const signer = useEthersSigner();
  const theme = useTheme();
  const { formatCurrencyAmount, formatDelta, formatTickPrice } = useFormatter();

  const parsedTokenId = parseTokenId(tokenIdFromUrl);
  const { loading, position: positionDetails } =
    useV3PositionFromTokenId(parsedTokenId);

  const {
    token0: token0Address,
    token1: token1Address,
    fee: feeAmount,
    liquidity,
    tickLower,
    tickUpper,
    tokenId,
  } = positionDetails || {};

  const removed = liquidity?.eq(0);

  const metadata = usePositionTokenURI(parsedTokenId);

  const token0 = useToken(token0Address);
  const token1 = useToken(token1Address);

  const currency0 = token0 ? unwrappedToken(token0) : undefined;
  const currency1 = token1 ? unwrappedToken(token1) : undefined;

  // flag for receiving WETH
  const [receiveWETH, setReceiveWETH] = useState(false);
  const nativeCurrency = useNativeCurrency(supportedChain);
  const nativeWrappedSymbol = nativeCurrency.wrapped.symbol;

  // get pool address from details returned
  const poolAddress =
    token0 && token1 && feeAmount
      ? Pool.getAddress(token0, token1, feeAmount)
      : undefined;

  // construct Position from details returned
  const [poolState, pool] = usePool(
    token0 ?? undefined,
    token1 ?? undefined,
    feeAmount
  );
  const position = useMemo(() => {
    if (
      pool &&
      liquidity &&
      typeof tickLower === "number" &&
      typeof tickUpper === "number"
    ) {
      return new Position({
        pool,
        liquidity: liquidity.toString(),
        tickLower,
        tickUpper,
      });
    }
    return undefined;
  }, [liquidity, pool, tickLower, tickUpper]);

  const tickAtLimit = useIsTickAtLimit(feeAmount, tickLower, tickUpper);

  const pricesFromPosition = getPriceOrderingFromPositionForUI(position);
  const [manuallyInverted, setManuallyInverted] = useState(false);

  // handle manual inversion
  const { priceLower, priceUpper, base } = useInverter({
    priceLower: pricesFromPosition.priceLower,
    priceUpper: pricesFromPosition.priceUpper,
    quote: pricesFromPosition.quote,
    base: pricesFromPosition.base,
    invert: manuallyInverted,
  });

  const inverted = token1 ? base?.equals(token1) : undefined;
  const currencyQuote = inverted ? currency0 : currency1;
  const currencyBase = inverted ? currency1 : currency0;

  const ratio = useMemo(() => {
    return priceLower && pool && priceUpper
      ? getRatio(
          inverted ? priceUpper.invert() : priceLower,
          pool.token0Price,
          inverted ? priceLower.invert() : priceUpper
        )
      : undefined;
  }, [inverted, pool, priceLower, priceUpper]);

  // fees
  const [feeValue0, feeValue1] = useV3PositionFees(
    pool ?? undefined,
    positionDetails?.tokenId,
    receiveWETH
  );

  // these currencies will match the feeValue{0,1} currencies for the purposes of fee collection
  const currency0ForFeeCollectionPurposes = pool
    ? receiveWETH
      ? pool.token0
      : unwrappedToken(pool.token0)
    : undefined;
  const currency1ForFeeCollectionPurposes = pool
    ? receiveWETH
      ? pool.token1
      : unwrappedToken(pool.token1)
    : undefined;

  const [collecting, setCollecting] = useState<boolean>(false);
  const [collectMigrationHash, setCollectMigrationHash] = useState<
    string | null
  >(null);
  const isCollectPending = useIsTransactionPending(
    collectMigrationHash ?? undefined
  );
  const [showConfirm, setShowConfirm] = useState(false);

  // usdc prices always in terms of tokens
  const price0 = useStablecoinPrice(token0 ?? undefined);
  const price1 = useStablecoinPrice(token1 ?? undefined);

  const fiatValueOfFees: CurrencyAmount<Currency> | null = useMemo(() => {
    if (!price0 || !price1 || !feeValue0 || !feeValue1) {
      return null;
    }

    // we wrap because it doesn't matter, the quote returns a USDC amount
    const feeValue0Wrapped = feeValue0?.wrapped;
    const feeValue1Wrapped = feeValue1?.wrapped;

    if (!feeValue0Wrapped || !feeValue1Wrapped) {
      return null;
    }

    const amount0 = price0.quote(feeValue0Wrapped);
    const amount1 = price1.quote(feeValue1Wrapped);
    return amount0.add(amount1);
  }, [price0, price1, feeValue0, feeValue1]);

  const fiatValueOfLiquidity: CurrencyAmount<Token> | null = useMemo(() => {
    if (!price0 || !price1 || !position) {
      return null;
    }
    const amount0 = price0.quote(position.amount0);
    const amount1 = price1.quote(position.amount1);
    return amount0.add(amount1);
  }, [price0, price1, position]);

  const addTransaction = useTransactionAdder();
  const positionManager = useV3NFTPositionManagerContract();
  const collect = useCallback(async () => {
    if (
      !currency0ForFeeCollectionPurposes ||
      !currency1ForFeeCollectionPurposes ||
      account.status !== "connected" ||
      !positionManager ||
      !tokenId ||
      !signer
    ) {
      return;
    }

    setCollecting(true);

    // we fall back to expecting 0 fees in case the fetch fails, which is safe in the
    // vast majority of cases
    const { calldata, value } =
      NonfungiblePositionManager.collectCallParameters({
        tokenId: tokenId.toString(),
        expectedCurrencyOwed0:
          feeValue0 ??
          CurrencyAmount.fromRawAmount(currency0ForFeeCollectionPurposes, 0),
        expectedCurrencyOwed1:
          feeValue1 ??
          CurrencyAmount.fromRawAmount(currency1ForFeeCollectionPurposes, 0),
        recipient: account.address,
      });

    const txn = {
      to: positionManager.address,
      data: calldata,
      value,
    };

    const connectedChainId = await signer.getChainId();
    if (account.chainId !== connectedChainId) {
      throw new WrongChainError();
    }

    signer
      .estimateGas(txn)
      .then((estimate) => {
        const newTxn = {
          ...txn,
          gasLimit: calculateGasMargin(estimate),
        };

        return signer
          .sendTransaction(newTxn)
          .then((response: TransactionResponse) => {
            setCollectMigrationHash(response.hash);
            setCollecting(false);

            sendAnalyticsEvent(LiquidityEventName.COLLECT_LIQUIDITY_SUBMITTED, {
              source: LiquiditySource.V3,
              label: [
                currency0ForFeeCollectionPurposes.symbol,
                currency1ForFeeCollectionPurposes.symbol,
              ].join("/"),
            });

            addTransaction(response, {
              type: TransactionType.COLLECT_FEES,
              currencyId0: currencyId(currency0ForFeeCollectionPurposes),
              currencyId1: currencyId(currency1ForFeeCollectionPurposes),
              expectedCurrencyOwed0:
                feeValue0?.quotient.toString() ??
                CurrencyAmount.fromRawAmount(
                  currency0ForFeeCollectionPurposes,
                  0
                ).toExact(),
              expectedCurrencyOwed1:
                feeValue1?.quotient.toString() ??
                CurrencyAmount.fromRawAmount(
                  currency1ForFeeCollectionPurposes,
                  0
                ).toExact(),
            });
          });
      })
      .catch((error) => {
        setCollecting(false);
        logger.error(error, {
          tags: {
            file: "PositionPage",
            function: "collectCallback",
          },
        });
      });
  }, [
    currency0ForFeeCollectionPurposes,
    currency1ForFeeCollectionPurposes,
    account.status,
    account.address,
    account.chainId,
    positionManager,
    tokenId,
    signer,
    feeValue0,
    feeValue1,
    addTransaction,
  ]);

  const owner = useSingleCallResult(
    tokenId ? positionManager : null,
    "ownerOf",
    [tokenId]
  ).result?.[0];
  const ownsNFT =
    owner === account.address || positionDetails?.operator === account.address;

  const feeValueUpper = inverted ? feeValue0 : feeValue1;
  const feeValueLower = inverted ? feeValue1 : feeValue0;

  // check if price is within range
  const below =
    pool && typeof tickLower === "number"
      ? pool.tickCurrent < tickLower
      : undefined;
  const above =
    pool && typeof tickUpper === "number"
      ? pool.tickCurrent >= tickUpper
      : undefined;
  const inRange: boolean =
    typeof below === "boolean" && typeof above === "boolean"
      ? !below && !above
      : false;

  function modalHeader() {
    return (
      <AutoColumn gap="md" style={{ marginTop: "20px" }}>
        <LightCard padding="12px 16px">
          <AutoColumn gap="md">
            <RowBetween>
              <RowFixed>
                <CurrencyLogo
                  currency={feeValueUpper?.currency}
                  size={20}
                  style={{ marginRight: "0.5rem" }}
                />
                <ThemedText.DeprecatedMain>
                  {feeValueUpper
                    ? formatCurrencyAmount({ amount: feeValueUpper })
                    : "-"}
                </ThemedText.DeprecatedMain>
              </RowFixed>
              <ThemedText.DeprecatedMain>
                {feeValueUpper?.currency?.symbol}
              </ThemedText.DeprecatedMain>
            </RowBetween>
            <RowBetween>
              <RowFixed>
                <CurrencyLogo
                  currency={feeValueLower?.currency}
                  size={20}
                  style={{ marginRight: "0.5rem" }}
                />
                <ThemedText.DeprecatedMain>
                  {feeValueLower
                    ? formatCurrencyAmount({ amount: feeValueLower })
                    : "-"}
                </ThemedText.DeprecatedMain>
              </RowFixed>
              <ThemedText.DeprecatedMain>
                {feeValueLower?.currency?.symbol}
              </ThemedText.DeprecatedMain>
            </RowBetween>
          </AutoColumn>
        </LightCard>
        <Text fontSize={12} fontStyle="italic" color="$neutral2">
          <Trans i18nKey="pool.collectingFeesWithdraw" />
        </Text>
        <ButtonPrimary
          data-testid="modal-collect-fees-button"
          onClick={collect}
        >
          <Trans i18nKey="common.collect.button" />
        </ButtonPrimary>
      </AutoColumn>
    );
  }

  const showCollectAsWeth = Boolean(
    ownsNFT &&
      (feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0)) &&
      currency0 &&
      currency1 &&
      (currency0.isNative || currency1.isNative) &&
      !collectMigrationHash
  );

  if (!positionDetails && !loading) {
    return <PositionPageUnsupportedContent />;
  }

  return loading || poolState === PoolState.LOADING || !feeAmount ? (
    <LoadingRows>
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </LoadingRows>
  ) : (
    <Trace logImpression page={InterfacePageName.POOL_PAGE}>
      <>
        <Helmet>
          <title>
            {t(
              `Manage {{quoteSymbol}}/{{baseSymbol}} pool liquidity on Uniswap`,
              {
                quoteSymbol: currencyQuote?.symbol,
                baseSymbol: currencyBase?.symbol,
              }
            )}
          </title>
        </Helmet>
        <PageWrapper>
          <LeftPane>
            <TransactionConfirmationModal
              isOpen={showConfirm}
              onDismiss={() => setShowConfirm(false)}
              attemptingTxn={collecting}
              hash={collectMigrationHash ?? ""}
              reviewContent={() => (
                <ConfirmationModalContent
                  title={<Trans i18nKey="pool.claimFees" />}
                  onDismiss={() => setShowConfirm(false)}
                  topContent={modalHeader}
                />
              )}
              pendingText={<Trans i18nKey="common.collecting.fees" />}
            />
            <AutoColumn gap="md">
              <AutoColumn gap="sm">
                <Link
                  data-cy="visit-pool"
                  style={{
                    textDecoration: "none",
                    width: "fit-content",
                    marginBottom: "0.5rem",
                  }}
                  to="/pool"
                >
                  <HoverText>
                    ← <Trans i18nKey="pool.back" />
                  </HoverText>
                </Link>
                <ResponsiveRow>
                  <PositionLabelRow>
                    <DoubleCurrencyLogo
                      currencies={[currencyBase, currencyQuote]}
                      size={24}
                    />
                    <StyledPoolLink
                      to={
                        poolAddress
                          ? getPoolDetailsURL(
                              poolAddress,
                              chainIdToBackendChain({
                                chainId: supportedChain,
                                withFallback: true,
                              })
                            )
                          : ""
                      }
                    >
                      <PairHeader>
                        &nbsp;{currencyQuote?.symbol}&nbsp;/&nbsp;
                        {currencyBase?.symbol}
                      </PairHeader>
                    </StyledPoolLink>
                    <Badge style={{ marginRight: "8px" }}>
                      <BadgeText>
                        {formatDelta(
                          parseFloat(
                            new Percent(feeAmount, 1_000_000).toSignificant()
                          )
                        )}
                      </BadgeText>
                    </Badge>
                    <RangeBadge removed={removed} inRange={inRange} />
                  </PositionLabelRow>
                  {ownsNFT && (
                    <ActionButtonResponsiveRow>
                      {currency0 && currency1 && feeAmount && tokenId ? (
                        <ButtonGray
                          as={Link}
                          to={`/add/${currencyId(currency0)}/${currencyId(
                            currency1
                          )}/${feeAmount}/${tokenId}`}
                          padding="6px 8px"
                          width="fit-content"
                          $borderRadius="12px"
                          style={{ marginRight: "8px" }}
                        >
                          <Trans i18nKey="pool.increaseLiquidity" />
                        </ButtonGray>
                      ) : null}
                      {tokenId && !removed ? (
                        <SmallButtonPrimary
                          as={Link}
                          to={`/remove/${tokenId}`}
                          padding="6px 8px"
                          width="fit-content"
                          $borderRadius="12px"
                        >
                          <Trans i18nKey="pool.removeLiquidity" />
                        </SmallButtonPrimary>
                      ) : null}
                    </ActionButtonResponsiveRow>
                  )}
                </ResponsiveRow>
              </AutoColumn>
              <ResponsiveRow align="flex-start">
                <HideSmall
                  style={{
                    height: "100%",
                    marginRight: 12,
                  }}
                >
                  {"result" in metadata ? (
                    <DarkCard
                      width="100%"
                      height="100%"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexDirection: "column",
                        justifyContent: "space-around",
                        minWidth: "340px",
                      }}
                    >
                      <NFT image={metadata.result.image} height={400} />
                      {typeof account.chainId === "number" &&
                      owner &&
                      !ownsNFT ? (
                        <ExternalLink
                          href={getExplorerLink(
                            account.chainId,
                            owner,
                            ExplorerDataType.ADDRESS
                          )}
                        >
                          <Trans i18nKey="pool.owner" />
                        </ExternalLink>
                      ) : null}
                    </DarkCard>
                  ) : (
                    <DarkCard
                      width="100%"
                      height="100%"
                      style={{
                        minWidth: "340px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <LoadingFullscreen />
                    </DarkCard>
                  )}
                </HideSmall>
                <AutoColumn gap="sm" style={{ width: "100%", height: "100%" }}>
                  <DarkCard>
                    <AutoColumn gap="md" style={{ width: "100%" }}>
                      <AutoColumn gap="md">
                        <Label>
                          <Trans i18nKey="common.liquidity" />
                        </Label>
                        {fiatValueOfLiquidity?.greaterThan(
                          new Fraction(1, 100)
                        ) ? (
                          <ThemedText.DeprecatedLargeHeader
                            fontSize="36px"
                            fontWeight={535}
                          >
                            {formatCurrencyAmount({
                              amount: fiatValueOfLiquidity,
                              type: NumberType.FiatTokenPrice,
                            })}
                          </ThemedText.DeprecatedLargeHeader>
                        ) : (
                          <ThemedText.DeprecatedLargeHeader
                            color={theme.neutral1}
                            fontSize="36px"
                            fontWeight={535}
                          >
                            -
                          </ThemedText.DeprecatedLargeHeader>
                        )}
                      </AutoColumn>
                      <LightCard padding="12px 16px">
                        <AutoColumn gap="md">
                          <RowBetween>
                            <LinkedCurrency
                              chainId={account.chainId ?? ChainId.MAINNET}
                              currency={currencyQuote}
                            />
                            <RowFixed>
                              <ThemedText.DeprecatedMain>
                                {formatCurrencyAmount({
                                  amount: inverted
                                    ? position?.amount0
                                    : position?.amount1,
                                })}
                              </ThemedText.DeprecatedMain>
                              {typeof ratio === "number" && !removed ? (
                                <Badge style={{ marginLeft: "10px" }}>
                                  <BadgeText>
                                    <Trans
                                      i18nKey="common.percentage"
                                      values={{
                                        pct: inverted ? ratio : 100 - ratio,
                                      }}
                                    />
                                  </BadgeText>
                                </Badge>
                              ) : null}
                            </RowFixed>
                          </RowBetween>
                          <RowBetween>
                            <LinkedCurrency
                              chainId={account.chainId ?? ChainId.MAINNET}
                              currency={currencyBase}
                            />
                            <RowFixed>
                              <ThemedText.DeprecatedMain>
                                {formatCurrencyAmount({
                                  amount: inverted
                                    ? position?.amount1
                                    : position?.amount0,
                                })}
                              </ThemedText.DeprecatedMain>
                              {typeof ratio === "number" && !removed ? (
                                <Badge style={{ marginLeft: "10px" }}>
                                  <BadgeText>
                                    <Trans
                                      i18nKey="common.percentage"
                                      values={{
                                        pct: inverted ? 100 - ratio : ratio,
                                      }}
                                    />
                                  </BadgeText>
                                </Badge>
                              ) : null}
                            </RowFixed>
                          </RowBetween>
                        </AutoColumn>
                      </LightCard>
                    </AutoColumn>
                  </DarkCard>
                  <DarkCard>
                    <AutoColumn gap="md" style={{ width: "100%" }}>
                      <AutoColumn gap="md">
                        <RowBetween style={{ alignItems: "flex-start" }}>
                          <AutoColumn gap="md">
                            <Label>
                              <Trans i18nKey="pool.unclaimedFees" />
                            </Label>
                            {fiatValueOfFees?.greaterThan(
                              new Fraction(1, 100)
                            ) ? (
                              <ThemedText.DeprecatedLargeHeader
                                color={theme.success}
                                fontSize="36px"
                                fontWeight={535}
                              >
                                {formatCurrencyAmount({
                                  amount: fiatValueOfFees,
                                  type: NumberType.FiatTokenPrice,
                                })}
                              </ThemedText.DeprecatedLargeHeader>
                            ) : (
                              <ThemedText.DeprecatedLargeHeader
                                color={theme.neutral1}
                                fontSize="36px"
                                fontWeight={535}
                              >
                                -
                              </ThemedText.DeprecatedLargeHeader>
                            )}
                          </AutoColumn>
                          {ownsNFT &&
                          (feeValue0?.greaterThan(0) ||
                            feeValue1?.greaterThan(0) ||
                            !!collectMigrationHash) ? (
                            <ResponsiveButtonConfirmed
                              data-testid="collect-fees-button"
                              disabled={collecting || !!collectMigrationHash}
                              confirmed={
                                !!collectMigrationHash && !isCollectPending
                              }
                              width="fit-content"
                              style={{ borderRadius: "12px" }}
                              padding="4px 8px"
                              onClick={() => setShowConfirm(true)}
                            >
                              {!!collectMigrationHash && !isCollectPending ? (
                                <ThemedText.DeprecatedMain
                                  color={theme.neutral1}
                                >
                                  <Trans i18nKey="pool.collected" />
                                </ThemedText.DeprecatedMain>
                              ) : isCollectPending || collecting ? (
                                <ThemedText.DeprecatedMain
                                  color={theme.neutral1}
                                >
                                  {" "}
                                  <Dots>
                                    <Trans i18nKey="pool.collecting" />
                                  </Dots>
                                </ThemedText.DeprecatedMain>
                              ) : (
                                <>
                                  <ThemedText.DeprecatedMain
                                    color={theme.white}
                                  >
                                    <Trans i18nKey="pool.collectingFees" />
                                  </ThemedText.DeprecatedMain>
                                </>
                              )}
                            </ResponsiveButtonConfirmed>
                          ) : null}
                        </RowBetween>
                      </AutoColumn>
                      <LightCard padding="12px 16px">
                        <AutoColumn gap="md">
                          <RowBetween>
                            <RowFixed>
                              <CurrencyLogo
                                currency={feeValueUpper?.currency}
                                size={20}
                                style={{ marginRight: "0.5rem" }}
                              />
                              <ThemedText.DeprecatedMain>
                                {feeValueUpper?.currency?.symbol}
                              </ThemedText.DeprecatedMain>
                            </RowFixed>
                            <RowFixed>
                              <ThemedText.DeprecatedMain>
                                {feeValueUpper
                                  ? formatCurrencyAmount({
                                      amount: feeValueUpper,
                                    })
                                  : "-"}
                              </ThemedText.DeprecatedMain>
                            </RowFixed>
                          </RowBetween>
                          <RowBetween>
                            <RowFixed>
                              <CurrencyLogo
                                currency={feeValueLower?.currency}
                                size={20}
                                style={{ marginRight: "0.5rem" }}
                              />
                              <ThemedText.DeprecatedMain>
                                {feeValueLower?.currency?.symbol}
                              </ThemedText.DeprecatedMain>
                            </RowFixed>
                            <RowFixed>
                              <ThemedText.DeprecatedMain>
                                {feeValueLower
                                  ? formatCurrencyAmount({
                                      amount: feeValueLower,
                                    })
                                  : "-"}
                              </ThemedText.DeprecatedMain>
                            </RowFixed>
                          </RowBetween>
                        </AutoColumn>
                      </LightCard>
                      {showCollectAsWeth && (
                        <AutoColumn gap="md">
                          <RowBetween>
                            <ThemedText.DeprecatedMain>
                              <Trans
                                i18nKey="pool.collectAs"
                                values={{ nativeWrappedSymbol }}
                              />
                            </ThemedText.DeprecatedMain>
                            <Toggle
                              id="receive-as-weth"
                              isActive={receiveWETH}
                              toggle={() =>
                                setReceiveWETH((receiveWETH) => !receiveWETH)
                              }
                            />
                          </RowBetween>
                        </AutoColumn>
                      )}
                    </AutoColumn>
                  </DarkCard>
                </AutoColumn>
              </ResponsiveRow>
              {incentiveId ? (
                <DarkCard>
                  <AutoColumn gap="md">
                    <RowBetween>
                      <RowFixed>
                        <Label display="flex" style={{ marginRight: "12px" }}>
                          <Trans i18nKey="common.incentives" />
                        </Label>
                      </RowFixed>
                    </RowBetween>
                    <UserDetailsCard
                      tokenId={Number(tokenId?.toString() ?? 0)}
                      incentiveId={incentiveId ?? ""}
                    />
                  </AutoColumn>
                </DarkCard>
              ) : (
                <></>
              )}
            </AutoColumn>
          </LeftPane>
          <RightPane>
            {account?.address && (
              <DarkCardWithOverflow>
                <IncentivesList
                  tokenId={Number(tokenId?.toString() ?? 0)}
                  poolAddress={poolAddress ?? ""}
                />
              </DarkCardWithOverflow>
            )}
          </RightPane>
        </PageWrapper>
        <DarkCard style={{ width: "98%" }}>
          <AutoColumn gap="md">
            <RowBetween>
              <RowFixed>
                <Label display="flex" style={{ marginRight: "12px" }}>
                  <Trans i18nKey="pool.priceRange" />
                </Label>
                <HideExtraSmall>
                  <>
                    <RangeBadge removed={removed} inRange={inRange} />
                    <span style={{ width: "8px" }} />
                  </>
                </HideExtraSmall>
              </RowFixed>
              <RowFixed>
                {currencyBase && currencyQuote && (
                  <RateToggle
                    currencyA={currencyBase}
                    currencyB={currencyQuote}
                    handleRateToggle={() =>
                      setManuallyInverted(!manuallyInverted)
                    }
                  />
                )}
              </RowFixed>
            </RowBetween>

            <RowBetween>
              <LightCard padding="12px" width="100%">
                <AutoColumn gap="sm" justify="center">
                  <ExtentsText>
                    <Trans i18nKey="pool.minPrice" />
                  </ExtentsText>
                  <ThemedText.DeprecatedMediumHeader textAlign="center">
                    {formatTickPrice({
                      price: priceLower,
                      atLimit: tickAtLimit,
                      direction: Bound.LOWER,
                      numberType: NumberType.TokenTx,
                    })}
                  </ThemedText.DeprecatedMediumHeader>
                  <ExtentsText>
                    {" "}
                    <Trans
                      i18nKey="common.feesEarnedPerBase"
                      values={{
                        symbolA: currencyQuote?.symbol,
                        symbolB: currencyBase?.symbol,
                      }}
                    />
                  </ExtentsText>

                  {inRange && (
                    <Text fontSize={11} color="$neutral3">
                      <Trans i18nKey="pool.position.100" />
                    </Text>
                  )}
                </AutoColumn>
              </LightCard>

              <DoubleArrow>⟷</DoubleArrow>
              <LightCard padding="12px" width="100%">
                <AutoColumn gap="sm" justify="center">
                  <ExtentsText>
                    <Trans i18nKey="pool.maxPrice" />
                  </ExtentsText>
                  <ThemedText.DeprecatedMediumHeader textAlign="center">
                    {formatTickPrice({
                      price: priceUpper,
                      atLimit: tickAtLimit,
                      direction: Bound.UPPER,
                      numberType: NumberType.TokenTx,
                    })}
                  </ThemedText.DeprecatedMediumHeader>
                  <ExtentsText>
                    {" "}
                    <Trans
                      i18nKey="common.feesEarnedPerBase"
                      values={{
                        symbolA: currencyQuote?.symbol,
                        symbolB: currencyBase?.symbol,
                      }}
                    />
                  </ExtentsText>

                  {inRange && (
                    <Text fontSize={11} color="$neutral3">
                      <Trans
                        i18nKey="pool.position.100.at"
                        values={{ symbol: currencyQuote?.symbol }}
                      />
                    </Text>
                  )}
                </AutoColumn>
              </LightCard>
            </RowBetween>
            <CurrentPriceCard
              inverted={inverted}
              pool={pool}
              currencyQuote={currencyQuote}
              currencyBase={currencyBase}
            />
          </AutoColumn>
        </DarkCard>
        <SwitchLocaleLink />
      </>
    </Trace>
  );
}
