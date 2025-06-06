import { SwitchLocaleLink } from "components/SwitchLocaleLink";
import { useLocation } from "react-router-dom";
import Trace from "uniswap/src/features/telemetry/Trace";
import styled from "styled-components";
import { useRef } from "react";
import { PageWrapper } from "components/swap/styled";

const rocketxApiKey = process.env.REACT_APP_ROCKETX_API_KEY || "";

const CenteredContainer = styled.div`
  display: flex;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  iframe {
    border: none;
  }
`;

export default function CrossChainSwapPage() {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const widgetUrl = new URL(
    "https://widget.rocketx.exchange/swap/TARAXA.taraxa/ETHEREUM.ethereum"
  );
  widgetUrl.searchParams.set("rx_t", "dark"); //theme
  widgetUrl.searchParams.set("rx_p_c", "15aa5a"); //primary color
  widgetUrl.searchParams.set("rx_k", rocketxApiKey); //api key

  if (!rocketxApiKey) {
    return <div>Cross Chain Swap is not available</div>;
  }

  return (
    <Trace logImpression page={"cross-chain-swap-page"}>
      <PageWrapper>
        <CenteredContainer>
          <iframe
            ref={iframeRef}
            height="880px"
            width="600px"
            src={widgetUrl.toString()}
          />
        </CenteredContainer>
      </PageWrapper>
      {location.pathname === "/cross-chain-swap" && <SwitchLocaleLink />}
    </Trace>
  );
}
