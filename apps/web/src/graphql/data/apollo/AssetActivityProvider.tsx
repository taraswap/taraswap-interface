import { SubscriptionResult } from "@apollo/client";
import { useAccount } from "hooks/useAccount";
import usePrevious from "hooks/usePrevious";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  ActivityWebQueryResult,
  AssetActivityPartsFragment,
  Exact,
  OnAssetActivitySubscription,
  useActivityWebLazyQuery,
  useOnAssetActivitySubscription,
} from "uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks";
import { FeatureFlags } from "uniswap/src/features/gating/flags";
import { useFeatureFlag } from "uniswap/src/features/gating/hooks";
import { logger } from "utilities/src/logger/logger";
import { v4 as uuidV4 } from "uuid";
import { GQL_MAINNET_CHAINS_MUTABLE } from "../util";
import { createAdaptiveRefetchContext } from "./AdaptiveRefetch";

const {
  Provider: AdaptiveAssetActivityProvider,
  useQuery: useAssetActivityQuery,
} = createAdaptiveRefetchContext<ActivityWebQueryResult>();

const SubscriptionContext = createContext<
  | SubscriptionResult<
      OnAssetActivitySubscription,
      Exact<{ account: string; subscriptionId: string }>
    >
  | undefined
>(undefined);

export function AssetActivityProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const previousAccount = usePrevious(account.address);

  const isRealtimeEnabled = useFeatureFlag(FeatureFlags.Realtime);
  const [attempt, incrementAttempt] = useReducer((attempt) => attempt + 1, 1);
  const subscriptionId = useMemo(uuidV4, [account, attempt]);
  const result = useOnAssetActivitySubscription({
    variables: { account: account.address ?? "", subscriptionId },
    skip: !account || !isRealtimeEnabled,
    onError: (error) => {
      logger.error(error, {
        tags: {
          file: "AssetActivityProvider",
          function: "useOnAssetActivitySubscription#onError",
        },
      });
      incrementAttempt();
    },
  });

  const [lazyFetch, query] = useActivityWebLazyQuery();
  const fetch = useCallback(
    () =>
      lazyFetch({
        variables: {
          account: account.address ?? "",
          chains: GQL_MAINNET_CHAINS_MUTABLE,
        },
      }),
    [account.address, lazyFetch]
  );

  return (
    <SubscriptionContext.Provider value={result}>
      <AdaptiveAssetActivityProvider
        query={query}
        fetch={fetch}
        stale={account.address !== previousAccount}
      >
        {children}
      </AdaptiveAssetActivityProvider>
    </SubscriptionContext.Provider>
  );
}

export function useAssetActivitySubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) {
    throw new Error(
      "useAssetActivitySubscription must be used within an AssetActivityProvider"
    );
  }
  return value;
}

function useSubscribedActivities() {
  const account = useAccount();
  const previousAccount = usePrevious(account.address);

  const [subscribedActivities, setSubscribedActivities] = useState<
    AssetActivityPartsFragment[]
  >([]);

  // Clear the subscribed activity list when the account changes.
  useEffect(() => {
    if (account.address !== previousAccount) {
      setSubscribedActivities([]);
    }
  }, [account.address, previousAccount]);

  // Update the subscribed activity list when a new activity is received from the subscription service.
  const subscription = useAssetActivitySubscription();
  useEffect(() => {
    const subscribedActivity = subscription.data?.onAssetActivity;
    if (subscribedActivity) {
      setSubscribedActivities((prev) => [subscribedActivity, ...prev]);
    }
  }, [subscription.data?.onAssetActivity]);

  return subscribedActivities;
}

export function useAssetActivity() {
  const query = useAssetActivityQuery();
  const { loading, data } = query;
  const fetchedActivities = data?.portfolios?.[0]?.assetActivities;
  const subscribedActivities = useSubscribedActivities();

  const activities = useMemo(() => {
    if (!fetchedActivities) {
      return subscribedActivities;
    }
    return [...subscribedActivities, ...fetchedActivities];
  }, [subscribedActivities, fetchedActivities]);

  return { activities, loading };
}
