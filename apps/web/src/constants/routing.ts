import { ChainId, Currency, Token, WETH9 } from "@taraswap/sdk-core";
import {
  ARB,
  BTC_BSC,
  BUSD_BSC,
  CEUR_CELO,
  CEUR_CELO_ALFAJORES,
  CUSD_CELO,
  CUSD_CELO_ALFAJORES,
  DAI,
  DAI_ARBITRUM_ONE,
  DAI_AVALANCHE,
  DAI_BSC,
  DAI_OPTIMISM,
  DAI_POLYGON,
  ETH_BSC,
  ETH_TARAXA,
  nativeOnChain,
  OP,
  PORTAL_ETH_CELO,
  STTARA_TARAXA,
  TSWAP_TARAXA,
  USDC_ARBITRUM,
  USDC_ARBITRUM_GOERLI,
  USDC_AVALANCHE,
  USDC_BASE,
  USDC_BSC,
  USDC_CELO,
  USDC_CELO_ALFAJORES,
  USDC_MAINNET,
  USDC_OPTIMISM,
  USDC_OPTIMISM_GOERLI,
  USDC_POLYGON,
  USDC_POLYGON_MUMBAI,
  USDC_TARAXA,
  USDM_TARAXA,
  USDT,
  USDT_ARBITRUM_ONE,
  USDT_AVALANCHE,
  USDT_BSC,
  USDT_OPTIMISM,
  USDT_POLYGON,
  USDT_TARAXA,
  WBTC,
  WBTC_ARBITRUM_ONE,
  WBTC_CELO,
  WBTC_OPTIMISM,
  WBTC_POLYGON,
  WETH_AVALANCHE,
  WETH_POLYGON,
  WETH_POLYGON_MUMBAI,
  WRAPPED_NATIVE_CURRENCY,
  WRAPPED_STTARA_TARAXA,
} from "constants/tokens";
import {
  getNativeLogoURI,
  getTokenLogoURI,
} from "lib/hooks/useCurrencyLogoURIs";
import {
  USDC_ZKSYNC,
  USDC_ZORA,
  USDT_TARAXA_TESTNET,
} from "uniswap/src/constants/tokens";
import { SafetyLevel } from "uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks";
import { CurrencyInfo } from "uniswap/src/features/dataApi/types";

type ChainTokenList = {
  readonly [chainId: number]: Token[];
};

type ChainCurrencyList = {
  readonly [chainId: number]: CurrencyInfo[];
};

const WRAPPED_NATIVE_CURRENCIES_ONLY: ChainTokenList = Object.fromEntries(
  Object.entries(WRAPPED_NATIVE_CURRENCY)
    .map(([key, value]) => [key, [value]])
    .filter(Boolean)
);

function buildCurrencyInfo(commonBase: Currency): CurrencyInfo {
  const logoUrl = commonBase.isNative
    ? getNativeLogoURI(commonBase.chainId)
    : getTokenLogoURI(commonBase.address, commonBase.chainId);
  return {
    currency: commonBase,
    logoUrl,
    safetyLevel: SafetyLevel.Verified,
    isSpam: false,
  } as CurrencyInfo;
}

/**
 * Shows up in the currency select for swap and add liquidity
 */
export const COMMON_BASES: ChainCurrencyList = {
  [ChainId.MAINNET]: [
    nativeOnChain(ChainId.MAINNET),
    DAI,
    USDC_MAINNET,
    USDT,
    WBTC,
    WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET] as Token,
  ].map(buildCurrencyInfo),
  [ChainId.GOERLI]: [
    nativeOnChain(ChainId.GOERLI),
    WRAPPED_NATIVE_CURRENCY[ChainId.GOERLI] as Token,
  ].map(buildCurrencyInfo),
  [ChainId.SEPOLIA]: [
    nativeOnChain(ChainId.SEPOLIA),
    WRAPPED_NATIVE_CURRENCY[ChainId.SEPOLIA] as Token,
  ].map(buildCurrencyInfo),
  [ChainId.ARBITRUM_ONE]: [
    nativeOnChain(ChainId.ARBITRUM_ONE),
    ARB,
    DAI_ARBITRUM_ONE,
    USDC_ARBITRUM,
    USDT_ARBITRUM_ONE,
    WBTC_ARBITRUM_ONE,
    WRAPPED_NATIVE_CURRENCY[ChainId.ARBITRUM_ONE] as Token,
  ].map(buildCurrencyInfo),
  [ChainId.ARBITRUM_GOERLI]: [
    nativeOnChain(ChainId.ARBITRUM_GOERLI),
    WRAPPED_NATIVE_CURRENCY[ChainId.ARBITRUM_GOERLI] as Token,
    USDC_ARBITRUM_GOERLI,
  ].map(buildCurrencyInfo),

  [ChainId.OPTIMISM]: [
    nativeOnChain(ChainId.OPTIMISM),
    OP,
    DAI_OPTIMISM,
    USDC_OPTIMISM,
    USDT_OPTIMISM,
    WBTC_OPTIMISM,
    WETH9[ChainId.OPTIMISM],
  ].map(buildCurrencyInfo),
  [ChainId.OPTIMISM_GOERLI]: [
    nativeOnChain(ChainId.OPTIMISM_GOERLI),
    USDC_OPTIMISM_GOERLI,
  ].map(buildCurrencyInfo),

  [ChainId.BASE]: [
    nativeOnChain(ChainId.BASE),
    WRAPPED_NATIVE_CURRENCY[ChainId.BASE] as Token,
    USDC_BASE,
  ].map(buildCurrencyInfo),
  [ChainId.BLAST]: [
    nativeOnChain(ChainId.BLAST),
    WRAPPED_NATIVE_CURRENCY[ChainId.BLAST] as Token,
  ].map(buildCurrencyInfo),

  [ChainId.POLYGON]: [
    nativeOnChain(ChainId.POLYGON),
    WETH_POLYGON,
    USDC_POLYGON,
    DAI_POLYGON,
    USDT_POLYGON,
    WBTC_POLYGON,
  ].map(buildCurrencyInfo),
  [ChainId.POLYGON_MUMBAI]: [
    nativeOnChain(ChainId.POLYGON_MUMBAI),
    WRAPPED_NATIVE_CURRENCY[ChainId.POLYGON_MUMBAI] as Token,
    USDC_POLYGON_MUMBAI,
    WETH_POLYGON_MUMBAI,
  ].map(buildCurrencyInfo),

  [ChainId.CELO]: [
    nativeOnChain(ChainId.CELO),
    CEUR_CELO,
    CUSD_CELO,
    PORTAL_ETH_CELO,
    USDC_CELO,
    WBTC_CELO,
  ].map(buildCurrencyInfo),

  [ChainId.CELO_ALFAJORES]: [
    nativeOnChain(ChainId.CELO_ALFAJORES),
    CUSD_CELO_ALFAJORES,
    CEUR_CELO_ALFAJORES,
    USDC_CELO_ALFAJORES,
  ].map(buildCurrencyInfo),

  [ChainId.BNB]: [
    nativeOnChain(ChainId.BNB),
    DAI_BSC,
    USDC_BSC,
    USDT_BSC,
    ETH_BSC,
    BTC_BSC,
    BUSD_BSC,
  ].map(buildCurrencyInfo),

  [ChainId.AVALANCHE]: [
    nativeOnChain(ChainId.AVALANCHE),
    DAI_AVALANCHE,
    USDC_AVALANCHE,
    USDT_AVALANCHE,
    WETH_AVALANCHE,
  ].map(buildCurrencyInfo),

  [ChainId.ZORA]: [
    nativeOnChain(ChainId.ZORA),
    WRAPPED_NATIVE_CURRENCY[ChainId.ZORA] as Token,
    USDC_ZORA,
  ].map(buildCurrencyInfo),

  [ChainId.ZKSYNC]: [
    nativeOnChain(ChainId.ZKSYNC),
    WRAPPED_NATIVE_CURRENCY[ChainId.ZKSYNC] as Token,
    USDC_ZKSYNC,
  ].map(buildCurrencyInfo),

  [ChainId.TARAXA_TESTNET]: [
    nativeOnChain(ChainId.TARAXA_TESTNET),
    WRAPPED_NATIVE_CURRENCY[ChainId.TARAXA_TESTNET] as Token,
    USDT_TARAXA_TESTNET,
  ].map(buildCurrencyInfo),

  [ChainId.TARAXA]: [
    nativeOnChain(ChainId.TARAXA),
    WRAPPED_NATIVE_CURRENCY[ChainId.TARAXA] as Token,
    USDT_TARAXA,
    USDM_TARAXA,
    TSWAP_TARAXA,
    WRAPPED_STTARA_TARAXA,
    STTARA_TARAXA,
    ETH_TARAXA,
    USDC_TARAXA,
  ].map(buildCurrencyInfo),
};

// used to construct the list of all pairs we consider by default in the frontend
export const BASES_TO_TRACK_LIQUIDITY_FOR: ChainTokenList = {
  ...WRAPPED_NATIVE_CURRENCIES_ONLY,
  [ChainId.MAINNET]: [
    ...WRAPPED_NATIVE_CURRENCIES_ONLY[ChainId.MAINNET],
    DAI,
    USDC_MAINNET,
    USDT,
    WBTC,
  ],
  [ChainId.BNB]: [
    ...WRAPPED_NATIVE_CURRENCIES_ONLY[ChainId.BNB],
    DAI_BSC,
    USDC_BSC,
    USDT_BSC,
    BTC_BSC,
    BUSD_BSC,
    ETH_BSC,
  ],
  [ChainId.AVALANCHE]: [
    ...WRAPPED_NATIVE_CURRENCIES_ONLY[ChainId.AVALANCHE],
    DAI_AVALANCHE,
    USDC_AVALANCHE,
    USDT_AVALANCHE,
    WETH_AVALANCHE,
  ],
  [ChainId.TARAXA]: [
    ...WRAPPED_NATIVE_CURRENCIES_ONLY[ChainId.TARAXA],
    USDT_TARAXA,
    USDM_TARAXA,
  ],
  [ChainId.TARAXA_TESTNET]: [
    ...WRAPPED_NATIVE_CURRENCIES_ONLY[ChainId.TARAXA_TESTNET],
    USDT_TARAXA_TESTNET,
  ],
};

export const PINNED_PAIRS: { readonly [chainId: number]: [Token, Token][] } = {
  [ChainId.MAINNET]: [
    [
      new Token(
        ChainId.MAINNET,
        "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
        8,
        "cDAI",
        "Compound Dai"
      ),
      new Token(
        ChainId.MAINNET,
        "0x39AA39c021dfbaE8faC545936693aC917d5E7563",
        8,
        "cUSDC",
        "Compound USD Coin"
      ),
    ],
    [USDC_MAINNET, USDT],
    [DAI, USDT],
  ],
};
