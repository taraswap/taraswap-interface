import { ApolloClient, InMemoryCache } from "@apollo/client";
const GRAPHQL_ENDPOINT =
  "https://indexer.lswap.app/subgraphs/name/taraxa/uniswap-v3/graphql";

//TODO: Figure out how to make ApolloClient global variable
export default new ApolloClient({
  connectToDevTools: false,
  uri: GRAPHQL_ENDPOINT,
  headers: {
    "Content-Type": "application/json",
    Origin: "https://taraswap.app",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.110 Safari/537.36",
  },
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-first",
    },
  },
});
