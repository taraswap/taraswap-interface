import { Currency, Token } from "@taraswap/sdk-core";
import TokenSafety from "components/TokenSafety";
import { memo, useCallback, useEffect, useState } from "react";

import { useUserAddedTokens } from "state/user/userAddedTokens";
import { useWindowSize } from "../../hooks/screenSize";
import useLast from "../../hooks/useLast";
import Modal from "../Modal";
import {
  CurrencySearch,
  CurrencySearchFilters,
  CrossChainCurrencySearch,
} from "./CurrencySearch";
import { CrossChainCurrency } from "types/tokens";

interface CurrencySearchModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  selectedCurrency?: Currency | null;
  onCurrencySelect: (currency: Currency) => void;
  otherSelectedCurrency?: Currency | null;
  showCurrencyAmount?: boolean;
  currencySearchFilters?: CurrencySearchFilters;
}

interface CrossChainCurrencySearchModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  selectedCurrency: CrossChainCurrency | null;
  onCurrencySelect: (currency: CrossChainCurrency) => void;
  otherSelectedCurrency: CrossChainCurrency | null;
  currencySearchFilters?: CurrencySearchFilters;
}

enum CurrencyModalView {
  search,
  importToken,
  tokenSafety,
}

export default memo(function CurrencySearchModal({
  isOpen,
  onDismiss,
  onCurrencySelect,
  selectedCurrency,
  otherSelectedCurrency,
  showCurrencyAmount = true,
  currencySearchFilters,
}: CurrencySearchModalProps) {
  const [modalView, setModalView] = useState<CurrencyModalView>(
    CurrencyModalView.search
  );
  const lastOpen = useLast(isOpen);
  const userAddedTokens = useUserAddedTokens();

  useEffect(() => {
    if (isOpen && !lastOpen) {
      setModalView(CurrencyModalView.search);
    }
  }, [isOpen, lastOpen]);

  const showTokenSafetySpeedbump = (token: Token) => {
    setWarningToken(token);
    setModalView(CurrencyModalView.tokenSafety);
  };

  const handleCurrencySelect = useCallback(
    (currency: Currency, hasWarning?: boolean) => {
      if (
        hasWarning &&
        currency.isToken &&
        !userAddedTokens.find((token) => token.equals(currency))
      ) {
        showTokenSafetySpeedbump(currency);
      } else {
        onCurrencySelect(currency);
        onDismiss();
      }
    },
    [onDismiss, onCurrencySelect, userAddedTokens]
  );
  // used for token safety
  const [warningToken, setWarningToken] = useState<Token | undefined>();

  const { height: windowHeight } = useWindowSize();
  // change min height if not searching
  let modalHeight: number | undefined = 80;
  let content = null;
  switch (modalView) {
    case CurrencyModalView.search:
      if (windowHeight) {
        // Converts pixel units to vh for Modal component
        modalHeight = Math.min(Math.round((680 / windowHeight) * 100), 80);
      }
      content = (
        <CurrencySearch
          isOpen={isOpen}
          onDismiss={onDismiss}
          onCurrencySelect={handleCurrencySelect}
          selectedCurrency={selectedCurrency}
          otherSelectedCurrency={otherSelectedCurrency}
          showCurrencyAmount={showCurrencyAmount}
          filters={currencySearchFilters}
        />
      );
      break;
    case CurrencyModalView.tokenSafety:
      modalHeight = undefined;
      if (warningToken) {
        content = (
          <TokenSafety
            token0={warningToken}
            onContinue={() => handleCurrencySelect(warningToken)}
            onCancel={() => setModalView(CurrencyModalView.search)}
            showCancel={true}
          />
        );
      }
      break;
  }
  return (
    <Modal isOpen={isOpen} onDismiss={onDismiss} height={modalHeight}>
      {content}
    </Modal>
  );
});

export const CrossChainCurrencySearchModal = memo(
  function CrossChainCurrencySearchModal({
    isOpen,
    onDismiss,
    onCurrencySelect,
    selectedCurrency,
    otherSelectedCurrency,
  }: CrossChainCurrencySearchModalProps) {
    const handleCurrencySelect = useCallback(
      (currency: CrossChainCurrency) => {
        onCurrencySelect(currency);
        onDismiss();
      },
      [onDismiss, onCurrencySelect]
    );

    let modalHeight: number | undefined = 80;

    return (
      <Modal isOpen={isOpen} onDismiss={onDismiss} height={modalHeight}>
        <CrossChainCurrencySearch
          isOpen={isOpen}
          onDismiss={onDismiss}
          onCurrencySelect={handleCurrencySelect}
          selectedCurrency={selectedCurrency}
          otherSelectedCurrency={otherSelectedCurrency}
        />
      </Modal>
    );
  }
);
