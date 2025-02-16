import { InterfaceElementName, SwapEventName } from "@uniswap/analytics-events";
import { Currency, CurrencyAmount, Percent } from "@taraswap/sdk-core";
import { Pair } from "@taraswap/v2-sdk";
import { AutoColumn } from "components/Column";
import { DoubleCurrencyLogo } from "components/DoubleLogo";
import { LoadingOpacityContainer } from "components/Loader/styled";
import CurrencyLogo from "components/Logo/CurrencyLogo";
import { StyledNumericalInput } from "components/NumericalInput";
import { CurrencySearchFilters } from "components/SearchModal/CurrencySearch";
import Tooltip from "components/Tooltip";
import { useIsSupportedChainId } from "constants/chains";
import { PrefetchBalancesWrapper } from "graphql/data/apollo/TokenBalancesProvider";
import { useAccount } from "hooks/useAccount";
import { Trans } from "i18n";
import ms from "ms";
import { darken } from "polished";
import { ReactNode, forwardRef, useCallback, useEffect, useState } from "react";
import { Lock } from "react-feather";
import styled, { useTheme } from "styled-components";
import { ThemedText } from "theme/components";
import { flexColumnNoWrap, flexRowNoWrap } from "theme/styles";
import { NumberType, useFormatter } from "utils/formatNumbers";

import { useSwapAndLimitContext } from "state/swap/hooks";
import { Text } from "ui/src";
import Trace from "uniswap/src/features/telemetry/Trace";
import { ReactComponent as DropDown } from "../../assets/images/dropdown.svg";
import { useCurrencyBalance } from "../../state/connection/hooks";
import { ButtonGray } from "../Button";
import { RowBetween, RowFixed } from "../Row";
import CurrencySearchModal, {
  CrossChainCurrencySearchModal,
} from "../SearchModal/CurrencySearchModal";
import { FiatValue } from "./FiatValue";
import { formatCrossChainCurrencySymbol, formatCurrencySymbol } from "./utils";
import { CrossChainCurrency } from "types/tokens";
import { CrossChainCurrencyLogo } from "components/SearchModal/CurrencyList";

export const InputPanel = styled.div<{ hideInput?: boolean }>`
  ${flexColumnNoWrap};
  position: relative;
  border-radius: ${({ hideInput }) => (hideInput ? "16px" : "20px")};
  z-index: 1;
  width: ${({ hideInput }) => (hideInput ? "100%" : "initial")};
  transition: height 1s ease;
  will-change: height;
`;

const FixedContainer = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const Container = styled.div<{ hideInput: boolean }>`
  min-height: 44px;
  border-radius: ${({ hideInput }) => (hideInput ? "16px" : "20px")};
  width: ${({ hideInput }) => (hideInput ? "100%" : "initial")};
`;

interface CurrencySelectProps {
  visible: boolean;
  selected: boolean;
  hideInput?: boolean;
  disabled?: boolean;
  animateShake?: boolean;
}

export const CurrencySelect = styled(ButtonGray)<CurrencySelectProps>`
  align-items: center;
  background-color: ${({ selected, theme }) =>
    selected ? theme.surface1 : theme.accent1};
  opacity: ${({ disabled }) => (!disabled ? 1 : 0.4)};
  color: ${({ selected, theme }) =>
    selected ? theme.neutral1 : theme.neutralContrast};
  cursor: pointer;
  height: 36px;
  border-radius: 18px;
  outline: none;
  user-select: none;
  border: 1px solid
    ${({ selected, theme }) => (selected ? theme.surface3 : theme.accent1)};
  font-size: 24px;
  font-weight: 485;
  width: ${({ hideInput }) => (hideInput ? "100%" : "initial")};
  padding: ${({ selected }) =>
    selected ? "4px 8px 4px 4px" : "6px 6px 6px 8px"};
  gap: 8px;
  justify-content: space-between;
  margin-left: ${({ hideInput }) => (hideInput ? "0" : "12px")};
  box-shadow: ${({ theme }) => theme.deprecated_shallowShadow};

  &:hover,
  &:active {
    background-color: ${({ theme, selected }) =>
      selected ? theme.surface2 : theme.accent1};
  }

  &:before {
    background-size: 100%;
    border-radius: inherit;

    position: absolute;
    top: 0;
    left: 0;

    width: 100%;
    height: 100%;
    content: "";
  }

  &:hover:before {
    background-color: ${({ theme }) => theme.deprecated_stateOverlayHover};
  }

  &:active:before {
    background-color: ${({ theme }) => theme.deprecated_stateOverlayPressed};
  }

  visibility: ${({ visible }) => (visible ? "visible" : "hidden")};

  @keyframes horizontal-shaking {
    0% {
      transform: translateX(0);
      animation-timing-function: ease-in-out;
    }
    20% {
      transform: translateX(10px);
      animation-timing-function: ease-in-out;
    }
    40% {
      transform: translateX(-10px);
      animation-timing-function: ease-in-out;
    }
    60% {
      transform: translateX(10px);
      animation-timing-function: ease-in-out;
    }
    80% {
      transform: translateX(-10px);
      animation-timing-function: ease-in-out;
    }
    100% {
      transform: translateX(0);
      animation-timing-function: ease-in-out;
    }
  }
  animation: ${({ animateShake }) =>
    animateShake ? "horizontal-shaking 300ms" : "none"};
`;

const InputRow = styled.div`
  ${flexRowNoWrap};
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
`;

const LabelRow = styled.div`
  ${flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.neutral2};
  font-size: 0.75rem;
  line-height: 1rem;

  span:hover {
    cursor: pointer;
    color: ${({ theme }) => darken(0.2, theme.neutral2)};
  }
`;

const FiatRow = styled(LabelRow)`
  justify-content: flex-end;
  min-height: 24px;
  padding: 8px 0px 0px 0px;
`;

const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StyledDropDown = styled(DropDown)<{ selected: boolean }>`
  margin: 0 0.25rem 0 0.35rem;
  height: 35%;
  margin-left: 8px;

  path {
    stroke: ${({ selected, theme }) =>
      selected ? theme.neutral1 : theme.neutralContrast};
    stroke-width: 2px;
  }
`;

const StyledTokenName = styled.span<{ active?: boolean }>`
  ${({ active }) =>
    active
      ? "  margin: 0 0.25rem 0 0.25rem;"
      : "  margin: 0 0.25rem 0 0.25rem;"}
  font-size: 20px;
  font-weight: 535;
`;

const StyledCrossChainTokenName = styled.span<{ active?: boolean }>`
  ${({ active }) =>
    active
      ? "  margin: 0 0.25rem 0 0.25rem;"
      : "  margin: 0 0.25rem 0 0.25rem;"}
  font-size: 20px;
  font-weight: 535;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const StyledBalanceMax = styled.button<{ disabled?: boolean }>`
  background-color: transparent;
  border: none;
  color: ${({ theme }) => theme.accent1};
  cursor: pointer;
  font-size: 14px;
  font-weight: 535;
  opacity: ${({ disabled }) => (!disabled ? 1 : 0.4)};
  padding: 4px 6px;
  pointer-events: ${({ disabled }) => (!disabled ? "initial" : "none")};

  :hover {
    opacity: ${({ disabled }) => (!disabled ? 0.8 : 0.4)};
  }

  :focus {
    outline: none;
  }
`;

interface SwapCurrencyInputPanelProps {
  value: string;
  onUserInput: (value: string) => void;
  onMax?: () => void;
  showMaxButton: boolean;
  label: ReactNode;
  onCurrencySelect?: (currency: Currency) => void;
  currency?: Currency | null;
  hideBalance?: boolean;
  pair?: Pair | null;
  hideInput?: boolean;
  otherCurrency?: Currency | null;
  fiatValue?: { data?: number | null; isLoading: boolean };
  priceImpact?: Percent;
  id: string;
  renderBalance?: (amount: CurrencyAmount<Currency>) => ReactNode;
  locked?: boolean;
  loading?: boolean;
  disabled?: boolean;
  currencySearchFilters?: CurrencySearchFilters;
  numericalInputSettings?: {
    disabled?: boolean;
    onDisabledClick?: () => void;
    disabledTooltipBody?: ReactNode;
  };
}

const SwapCurrencyInputPanel = forwardRef<
  HTMLInputElement,
  SwapCurrencyInputPanelProps
>(
  (
    {
      value,
      onUserInput,
      onMax,
      showMaxButton,
      onCurrencySelect,
      currency,
      otherCurrency,
      id,
      renderBalance,
      fiatValue,
      priceImpact,
      hideBalance = false,
      pair = null, // used for double token logo
      hideInput = false,
      locked = false,
      loading = false,
      disabled = false,
      currencySearchFilters,
      numericalInputSettings,
      label,
      ...rest
    },
    ref
  ) => {
    const [modalOpen, setModalOpen] = useState(false);
    const account = useAccount();
    const { chainId } = useSwapAndLimitContext();
    const chainAllowed = useIsSupportedChainId(chainId);
    const selectedCurrencyBalance = useCurrencyBalance(
      account.address,
      currency ?? undefined
    );
    const theme = useTheme();
    const { formatCurrencyAmount } = useFormatter();

    const handleDismissSearch = useCallback(() => {
      setModalOpen(false);
    }, [setModalOpen]);

    const [tooltipVisible, setTooltipVisible] = useState(false);
    const handleDisabledNumericalInputClick = useCallback(() => {
      if (numericalInputSettings?.disabled && !tooltipVisible) {
        setTooltipVisible(true);
        setTimeout(() => setTooltipVisible(false), ms("4s")); // reset shake animation state after 4s
        numericalInputSettings.onDisabledClick?.();
      }
    }, [tooltipVisible, numericalInputSettings]);

    // reset tooltip state when currency changes
    useEffect(() => setTooltipVisible(false), [currency]);

    return (
      <InputPanel id={id} hideInput={hideInput} {...rest}>
        {locked && (
          <FixedContainer>
            <AutoColumn gap="sm" justify="center">
              <Lock />
              <Text variant="body2" textAlign="center" px="$spacing12">
                <Trans i18nKey="swap.marketPrice.outsideRange.label" />
              </Text>
            </AutoColumn>
          </FixedContainer>
        )}

        <Container hideInput={hideInput}>
          <Text variant="body3" userSelect="none" color="$neutral2">
            {label}
          </Text>
          <InputRow
            style={hideInput ? { padding: "0", borderRadius: "8px" } : {}}
          >
            {!hideInput && (
              <div
                style={{ display: "flex", flexGrow: 1 }}
                onClick={handleDisabledNumericalInputClick}
              >
                <StyledNumericalInput
                  className="token-amount-input"
                  value={value}
                  onUserInput={onUserInput}
                  disabled={
                    !chainAllowed ||
                    disabled ||
                    numericalInputSettings?.disabled
                  }
                  $loading={loading}
                  id={id}
                  ref={ref}
                  maxDecimals={currency?.decimals}
                />
              </div>
            )}
            <PrefetchBalancesWrapper>
              <Tooltip
                show={tooltipVisible && !modalOpen}
                placement="bottom"
                offsetY={14}
                text={numericalInputSettings?.disabledTooltipBody}
              >
                <CurrencySelect
                  disabled={!chainAllowed || disabled}
                  visible={currency !== undefined}
                  selected={!!currency}
                  hideInput={hideInput}
                  className="open-currency-select-button"
                  onClick={() => {
                    if (onCurrencySelect) {
                      setModalOpen(true);
                    }
                  }}
                  animateShake={tooltipVisible}
                >
                  <Aligner>
                    <RowFixed>
                      {pair ? (
                        <span style={{ marginRight: "0.5rem" }}>
                          <DoubleCurrencyLogo
                            currencies={[pair.token0, pair.token1]}
                            size={24}
                          />
                        </span>
                      ) : currency ? (
                        <CurrencyLogo
                          style={{ marginRight: "2px" }}
                          currency={currency}
                          size={24}
                        />
                      ) : null}
                      {pair ? (
                        <StyledTokenName className="pair-name-container">
                          {pair?.token0.symbol}:{pair?.token1.symbol}
                        </StyledTokenName>
                      ) : (
                        <StyledTokenName
                          className="token-symbol-container"
                          active={Boolean(currency && currency.symbol)}
                        >
                          {currency ? (
                            formatCurrencySymbol(currency)
                          ) : (
                            <Trans i18nKey="common.selectToken" />
                          )}
                        </StyledTokenName>
                      )}
                    </RowFixed>
                    {onCurrencySelect && (
                      <StyledDropDown selected={!!currency} />
                    )}
                  </Aligner>
                </CurrencySelect>
              </Tooltip>
            </PrefetchBalancesWrapper>
          </InputRow>
          {Boolean(!hideInput && !hideBalance) && (
            <FiatRow>
              <RowBetween>
                <LoadingOpacityContainer $loading={loading}>
                  {fiatValue && (
                    <FiatValue
                      fiatValue={fiatValue}
                      priceImpact={priceImpact}
                      testId={`fiat-value-${id}`}
                    />
                  )}
                </LoadingOpacityContainer>
                {account ? (
                  <RowFixed style={{ height: "16px" }}>
                    <ThemedText.DeprecatedBody
                      data-testid="balance-text"
                      color={theme.neutral2}
                      fontWeight={485}
                      fontSize={14}
                      style={{ display: "inline" }}
                    >
                      {!hideBalance && currency && selectedCurrencyBalance ? (
                        renderBalance ? (
                          renderBalance(selectedCurrencyBalance)
                        ) : (
                          <Trans
                            i18nKey="swap.balance.amount"
                            values={{
                              amount: formatCurrencyAmount({
                                amount: selectedCurrencyBalance,
                                type: NumberType.TokenNonTx,
                              }),
                            }}
                          />
                        )
                      ) : null}
                    </ThemedText.DeprecatedBody>
                    {showMaxButton && selectedCurrencyBalance ? (
                      <Trace
                        logPress
                        eventOnTrigger={
                          SwapEventName.SWAP_MAX_TOKEN_AMOUNT_SELECTED
                        }
                        element={InterfaceElementName.MAX_TOKEN_AMOUNT_BUTTON}
                      >
                        <StyledBalanceMax onClick={onMax}>
                          <Trans i18nKey="common.max" />
                        </StyledBalanceMax>
                      </Trace>
                    ) : null}
                  </RowFixed>
                ) : (
                  <span />
                )}
              </RowBetween>
            </FiatRow>
          )}
        </Container>
        {onCurrencySelect && (
          <CurrencySearchModal
            isOpen={modalOpen}
            onDismiss={handleDismissSearch}
            onCurrencySelect={onCurrencySelect}
            selectedCurrency={currency}
            otherSelectedCurrency={otherCurrency}
            currencySearchFilters={currencySearchFilters}
          />
        )}
      </InputPanel>
    );
  }
);
SwapCurrencyInputPanel.displayName = "SwapCurrencyInputPanel";

export default SwapCurrencyInputPanel;

interface CrossChainSwapCurrencyInputPanelProps {
  id: string;
  label: any;
  hideInput: boolean;
  value: string | number;
  onCurrencySelect: (currency: CrossChainCurrency) => void;
  currency: CrossChainCurrency | null;
  otherCurrency: CrossChainCurrency | null;
  onUserInput: (input: string) => void;
  disabledInput?: boolean;
  isInputLoading?: boolean;
  disabled?: boolean;
}

export const CrossChainSwapCurrencyInputPanel = ({
  id,
  label,
  hideInput,
  value,
  currency,
  otherCurrency,
  onCurrencySelect,
  onUserInput,
  disabledInput = false,
  isInputLoading = false,
  disabled = false,
}: CrossChainSwapCurrencyInputPanelProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const handleDismissSearch = useCallback(() => {
    setModalOpen(false);
  }, [setModalOpen]);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => setTooltipVisible(false), [currency]);

  return (
    <InputPanel id={id} hideInput={hideInput}>
      <Container hideInput={hideInput}>
        <Text variant="body3" userSelect="none" color="$neutral2">
          {label}
        </Text>
        <InputRow
          style={hideInput ? { padding: "0", borderRadius: "8px" } : {}}
        >
          {!hideInput && (
            <div
              style={{
                display: "flex",
                flexGrow: 1,
              }}
              onClick={() => {}}
            >
              <StyledNumericalInput
                className="token-amount-input"
                value={value}
                onUserInput={onUserInput}
                disabled={disabledInput || disabled || isInputLoading}
                $loading={false}
                id={id}
                maxDecimals={18}
              />
            </div>
          )}
          <CurrencySelect
            disabled={disabled || isInputLoading}
            selected={!!currency}
            hideInput={hideInput}
            className="open-currency-select-button"
            onClick={() => {
              setModalOpen(true);
            }}
            animateShake={tooltipVisible}
            visible
          >
            <Aligner>
              <RowFixed>
                <StyledCrossChainTokenName
                  className="token-symbol-container"
                  active={Boolean(currency && currency.symbol)}
                >
                  {currency ? (
                    <CrossChainCurrencyLogo
                      src={currency.img}
                      alt={currency.name}
                      size={20}
                    />
                  ) : null}
                  {currency ? (
                    formatCrossChainCurrencySymbol(currency)
                  ) : (
                    <Trans i18nKey="common.selectToken" />
                  )}
                </StyledCrossChainTokenName>
              </RowFixed>
              <StyledDropDown selected={!!currency} />
            </Aligner>
          </CurrencySelect>
        </InputRow>
      </Container>
      {onCurrencySelect && (
        <CrossChainCurrencySearchModal
          isOpen={modalOpen}
          onDismiss={handleDismissSearch}
          onCurrencySelect={onCurrencySelect}
          selectedCurrency={currency}
          otherSelectedCurrency={otherCurrency}
        />
      )}
    </InputPanel>
  );
};
