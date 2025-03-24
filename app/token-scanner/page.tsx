"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

function getColorClass(value: number) {
  return value >= 0 ? "text-green-500" : "text-red-500";
}

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type DexToken = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  priceChange: {
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume: { h24: number };
  liquidity: { usd: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  trendingScore?: number;
  info?: {
    imageUrl?: string;
  };
  candles?: Candle[];
};

function computeTrending(token: DexToken): number {
  const { h1, h6, h24 } = token.priceChange || {};
  const avgChange = (Number(h1) + Number(h6) + Number(h24)) / 3;
  if (isNaN(avgChange)) return 0;
  const ratio =
    token.marketCap && token.marketCap > 0
      ? token.volume.h24 / token.marketCap
      : 1;
  let trending = avgChange * ratio;
  if (avgChange > 0) trending *= 1.1;
  return trending;
}

function getAge(createdAt?: number): string {
  if (!createdAt) return "N/A";
  const diffMs = Date.now() - createdAt;
  const days = diffMs / (1000 * 60 * 60 * 24);
  return days < 1 ? `${Math.floor(days * 24)}h` : `${Math.floor(days)}d`;
}

function getTxns24h(token: DexToken): number {
  if (!token.txns || !token.txns.h24) return 0;
  const { buys, sells } = token.txns.h24;
  return buys + sells;
}

function FlameIcon() {
  return (
    <motion.span
      animate={{
        scale: [1, 1.3, 1],
        rotate: [0, 3, -3, 0],
        y: [0, -1, 0],
      }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      className="inline-flex items-center justify-center text-lg sm:text-xl ml-1"
    >
      🔥
    </motion.span>
  );
}

export default function TokenScanner() {
  const router = useRouter();
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [toast, setToast] = useState("");

  const [sortFilter, setSortFilter] = useState("trending");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal and submission states
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setToast("Copied to clipboard");
      setTimeout(() => setToast(""), 2000);
    });
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/submit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenSymbol, tokenAddress, tokenLogo }),
      });
      if (response.ok) {
        setSubmissionSuccess(true);
      } else {
        setToast("Submission failed. Please try again.");
        setTimeout(() => setToast(""), 2000);
      }
    } catch (err) {
      console.error(err);
      setToast("Submission error. Please try again.");
      setTimeout(() => setToast(""), 2000);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmissionSuccess(false);
    setTokenSymbol("");
    setTokenAddress("");
    setTokenLogo("");
  };

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        // Provide your full comma-separated token address list.
        const tokenAddresses =
          "0x4B6104755AfB5Da4581B81C552DA3A25608c73B8," +
          "0x18b6f6049A0af4Ed2BBe0090319174EeeF89f53a," +
          "0x2f6c17fa9f9bC3600346ab4e48C0701e1d5962AE," +
          "0x1185cB5122Edad199BdBC0cbd7a0457e448f23c7," +
          "0xA6f774051dFb6b54869227fDA2DF9cb46f296c09," +
          "0x9a26F5433671751C3276a065f57e5a02D2817973," +
          "0x55cD6469F597452B5A7536e2CD98fDE4c1247ee4," +
          "0x6921B130D297cc43754afba22e5EAc0FBf8Db75b," +
          "0xBA5E66FB16944Da22A62Ea4FD70ad02008744460," +
          "0x52b492a33E447Cdb854c7FC19F1e57E8BfA1777D," +
          "0x20DD04c17AFD5c9a8b3f2cdacaa8Ee7907385BEF," +
          "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935," +
          "0xF5Bc3439f53A45607cCaD667AbC7DAF5A583633F," +
          "0x6dba065721435cfCa05CAa508f3316B637861373," +
          "0x1F1c695f6b4A3F8B05f2492ceF9474Afb6d6Ad69," +
          "0xBC45647eA894030a4E9801Ec03479739FA2485F0," +
          "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b," +
          "0xb8D98a102b0079B69FFbc760C8d857A31653e56e," +
          "0x940181a94A35A4569E4529A3CDfB74e38FD98631," +
          "0xB1a03EdA10342529bBF8EB700a06C60441fEf25d," +
          "0x2676E4e0E2eB58D9bdb5078358ff8A3a964CEdf5," +
          "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825," +
          "0xeB476e9aB6B1655860b3F40100678D0c1ceDB321," +
          "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe," +
          "0x79dacb99A8698052a9898E81Fdf883c29efb93cb," +
          "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb," +
          "0x768BE13e1680b5ebE0024C42c896E3dB59ec0149," +
          "0x6797B6244fA75F2e78cDFfC3a4eb169332b730cc," +
          "0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea," +
          "0x20d704099B62aDa091028bcFc44445041eD16f09," +
          "0xC438B0c0E80A8Fa1B36898d1b36A3fc2eC371C54," +
          "0x57eDc3F1fd42c0d48230e964b1C5184B9c89B2ed," +
          "0xD461A534AF11EF58E9F9add73129a1f45485A8dc," +
          "0x9704d2adBc02C085ff526a37ac64872027AC8a50," +
          "0x3C8cd0dB9a01EfA063a7760267b822A129bc7DCA," +
          "0xF878e27aFB649744EEC3c5c0d03bc9335703CFE3," +
          "0x290f057a2c59b95d8027aa4abf31782676502071," +
          "0x2133031F5aCbC493572c02f271186F241cd8D6a5," +
          "0x1B23819885FcE964A8B39D364b7462D6E597ae8e," +
          "0xc0634090F2Fe6c6d75e61Be2b949464aBB498973," +
          "0x02D4f76656C2B4f58430e91f8ac74896c9281Cb9," +
          "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b," +
          "0xc655C331d1Aa7f96c252F1f40CE13D80eAc53504," +
          "0x08c81699F9a357a9F0d04A09b353576ca328d60D," +
          "0xFbB75A59193A3525a8825BeBe7D4b56899E2f7e1," +
          "0x18A8BD1fe17A1BB9FFB39eCD83E9489cfD17a022," +
          "0xFad8CB754230dbFd249Db0E8ECCb5142DD675a0d," +
          "0x78a087d713Be963Bf307b18F2Ff8122EF9A63ae9," +
          "0x10f434B3d1cC13A4A79B062Dcc25706f64D10D47," +
          "0xa1832f7F4e534aE557f9B5AB76dE54B1873e498B," +
          "0x15aC90165f8B45A80534228BdCB124A011F62Fee," +
          "0xE3086852A4B125803C815a158249ae468A3254Ca," +
          "0xbDF317F9C153246C429F23f4093087164B145390," +
          "0x3c4b6Cd7874eDc945797123fcE2d9a871818524b," +
          "0x5B5dee44552546ECEA05EDeA01DCD7Be7aa6144A," +
          "0x98f4779FcCb177A6D856dd1DfD78cd15B7cd2af5," +
          "0xeec468333ccc16d4bf1cef497a56cf8c0aae4ca3," +
          "0x5dc232b8301e34efe2f0ea2a5a81da5b388bb45e," +
          "0x0fd7a301b51d0a83fcaf6718628174d527b373b6," +
          "0x2b5050f01d64fbb3e4ac44dc07f0732bfb5ecadf," +
          "0x81496f85abaf8bd2e13d90379fde86c533d8670d," +
          "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf," +
          "0x3a1609cebe67c1d303954b5fb907bef36213034b," +
          "0x767a739d1a152639e9ea1d8c1bd55fdc5b217d7f," +
          "0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870," +
          "0x2efb2110f352fc98cd39dc041887c41766dbb301," +
          "0x623cd3a3edf080057892aaf8d773bbb7a5c9b6e9," +
          "0x17d70172c7c4205bd39ce80f7f0ee660b7dc5a23," +
          "0x7588880d9c78e81fade7b7e8dc0781e95995a792," +
          "0x9beec80e62aa257ced8b0edd8692f79ee8783777," +
          "0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2," +
          "0x2e2cc4dfce60257f091980631e75f5c436b71c87," +
          "0x937a1cfaf0a3d9f5dc4d0927f72ee5e3e5f82a00," +
          "0x2bc08a6583f9bb980f26114c6b513252942e946f," +
          "0x0acb8f6a6f1a8df2b4846db0352caaa01d854bf8," +
          "0x41a188b74ffbcea2bd548644853d26ab0755cdb9," +
          "0x06f71fb90f84b35302d132322a3c90e4477333b0," +
          "0x98d59767cd1335071a4e9b9d3482685c915131e8," +
          "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842," +
          "0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2," +
          "0x24fcfc492c1393274b6bcd568ac9e225bec93584," +
          "0x98d0baa52b2d063e780de12f615f963fe8537553," +
          "0xb964c6bfa06894e91f008a4d2b3a2bad379462e4," +
          "0x2f20cf3466f80a5f7f532fca553c8cbc9727fef6," +
          "0x1c4cca7c5db003824208adda61bd749e55f463a3," +
          "0x3080ce06eee2869e1b0287ad0de73f9421f977a3," +
          "0xc0041ef357b183448b235a8ea73ce4e4ec8c265f," +
          "0x0c41f1fc9022feb69af6dc666abfe73c9ffda7ce," +
          "0x3636a7734b669ce352e97780df361ce1f809c58c," +
          "0xf1fc9580784335b2613c1392a530c1aa2a69ba3d," +
          "0x73326b4d0225c429bed050c11c4422d91470aaf4," +
          "0x9aaae745cf2830fb8ddc6248b17436dc3a5e701c," +
          "0x7431ada8a591c955a994a21710752ef9b882b8e3," +
          "0x625bb9bb04bdca51871ed6d07e2dd9034e914631,";
        
        const tokenList = tokenAddresses.split(",");
        const tokenChunks = [];
        for (let i = 0; i < tokenList.length; i += 30) {
          tokenChunks.push(tokenList.slice(i, i + 30));
        }
        let allResults: DexToken[] = [];
        for (const chunk of tokenChunks) {
          const joinedChunk = chunk.join(",");
          const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${joinedChunk}`);
          if (!res.ok) continue;
          const data = await res.json();
          allResults = [...allResults, ...data];
        }

        if (Array.isArray(allResults) && allResults.length > 0) {
          const tokensWithTrending = allResults.map((token) => ({
            ...token,
            trendingScore: computeTrending(token),
          }));
          const sorted = tokensWithTrending.sort(
            (a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)
          );
          setTokens(sorted);
        } else {
          setError("No tokens returned");
        }
      } catch (err) {
        console.error(err);
        setError("Error fetching token data");
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
    const interval = setInterval(() => {
      fetchTokens();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sortedTokens = useMemo(() => {
    if (sortFilter === "trending") {
      return [...tokens].sort(
        (a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)
      );
    }
    let key: "h1" | "h6" | "h24" = "h1";
    if (sortFilter === "6h") key = "h6";
    else if (sortFilter === "24h") key = "h24";
    return [...tokens].sort((a, b) => {
      const aVal = a.priceChange?.[key] ?? 0;
      const bVal = b.priceChange?.[key] ?? 0;
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [tokens, sortFilter, sortDirection]);

  const indexOfLastToken = currentPage * pageSize;
  const indexOfFirstToken = indexOfLastToken - pageSize;
  const currentTokens = sortedTokens.slice(indexOfFirstToken, indexOfLastToken);
  const totalPages = Math.ceil(sortedTokens.length / pageSize);

  function handleFilterChange(filter: string) {
    if (sortFilter === filter) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortFilter(filter);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  }

  return (
    <div className="w-screen h-screen bg-black text-white font-mono m-0 p-0 overflow-hidden">
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded shadow">
          {toast}
        </div>
      )}
      {/* Modal for Submit Listing */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white text-black p-6 rounded shadow-lg w-80">
            {/* Close "X" button */}
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-xl font-bold"
            >
              &times;
            </button>
            {!submissionSuccess ? (
              <>
                <h2 className="text-xl font-bold mb-4">Submit Token Listing</h2>
                <form onSubmit={handleSubmitListing}>
                  <div className="mb-4">
                    <label className="block mb-1">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1">Token Address</label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1">Logo URL</label>
                    <input
                      type="text"
                      value={tokenLogo}
                      onChange={(e) => setTokenLogo(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05 }}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                    >
                      Submit
                    </motion.button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">
                  Token Listing Submitted!
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={closeModal}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
                >
                  Close
                </motion.button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col w-full h-full">
        {/* Screener Banner */}
        <div className="sticky top-0 z-50 bg-[#0060FF] shadow-md w-full">
          <div className="w-full flex items-center justify-between px-2 py-2">
            <div className="text-left">
              <h1 className="text-sm sm:text-xl font-bold text-white whitespace-nowrap">
                Homebase Screener
              </h1>
            </div>
            <div className="flex space-x-2">
              <motion.button
                onClick={() => setShowModal(true)}
                whileHover={{ scale: 1.05 }}
                className="text-white text-xs sm:text-base font-mono whitespace-nowrap"
              >
                [Submit Listing]
              </motion.button>
              <motion.button
                onClick={() => router.back()}
                whileHover={{ scale: 1.05 }}
                className="text-white text-xs sm:text-base font-mono whitespace-nowrap"
              >
                [Return]
              </motion.button>
            </div>
          </div>
        </div>
        {/* Table + Pagination */}
        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
          <table className="table-auto w-full whitespace-nowrap text-sm">
            <thead className="bg-gray-900 text-gray-300">
              <tr>
                <th
                  className="p-1 sm:p-2 text-left cursor-pointer"
                  onClick={() => handleFilterChange("trending")}
                >
                  #
                  {sortFilter === "trending" &&
                    (sortDirection === "desc" ? " ↓" : " ↑")}
                </th>
                <th className="p-1 sm:p-2 text-left">POOL</th>
                <th className="p-1 sm:p-2 text-right">PRICE</th>
                <th className="p-1 sm:p-2 text-right">AGE</th>
                <th className="p-1 sm:p-2 text-right">TXN</th>
                <th
                  className="p-1 sm:p-2 text-right cursor-pointer"
                  onClick={() => handleFilterChange("1h")}
                >
                  1H{" "}
                  {sortFilter === "1h" &&
                    (sortDirection === "desc" ? " ↓" : " ↑")}
                </th>
                <th
                  className="p-1 sm:p-2 text-right cursor-pointer"
                  onClick={() => handleFilterChange("6h")}
                >
                  6H{" "}
                  {sortFilter === "6h" &&
                    (sortDirection === "desc" ? " ↓" : " ↑")}
                </th>
                <th
                  className="p-1 sm:p-2 text-right cursor-pointer"
                  onClick={() => handleFilterChange("24h")}
                >
                  24H{" "}
                  {sortFilter === "24h" &&
                    (sortDirection === "desc" ? " ↓" : " ↑")}
                </th>
                <th className="p-1 sm:p-2 text-right">VOLUME</th>
                <th className="p-1 sm:p-2 text-right">LIQUIDITY</th>
                <th className="p-1 sm:p-2 text-right">MCAP</th>
                <th className="p-1 sm:p-2 text-right">FDV</th>
                <th className="p-1 sm:p-2 text-right">Address</th>
              </tr>
            </thead>
            <tbody>
              {currentTokens.map((token, index) => {
                const rank = index + 1 + (currentPage - 1) * pageSize;
                const isTop3 = sortFilter === "trending" && rank <= 3;
                return (
                  <tr
                    key={token.pairAddress}
                    className="border-b border-gray-700 hover:bg-gray-800 transition-colors"
                  >
                    <td className="p-1 sm:p-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 font-bold">
                          {rank}
                        </span>
                        {isTop3 && <FlameIcon />}
                      </div>
                    </td>
                    <td className="p-1 sm:p-2">
                      <Link href={`/tokens/${token.baseToken.address}`}>
                        <div className="flex items-center space-x-2 cursor-pointer">
                          <img
                            src={token.info?.imageUrl || "/fallback.png"}
                            alt={token.baseToken.symbol}
                            className="w-5 h-5 rounded-full"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {token.baseToken.name} /{" "}
                              {token.quoteToken.symbol}
                            </span>
                            <span className="text-xs text-gray-400">
                              {token.baseToken.symbol}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      ${Number(token.priceUsd).toFixed(5)}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      {getAge(token.pairCreatedAt)}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      {getTxns24h(token)}
                    </td>
                    <td
                      className={`p-1 sm:p-2 text-right ${getColorClass(
                        token.priceChange?.h1 ?? 0
                      )}`}
                    >
                      {token.priceChange?.h1 !== undefined
                        ? token.priceChange.h1.toFixed(2)
                        : "N/A"}
                      %
                    </td>
                    <td
                      className={`p-1 sm:p-2 text-right ${getColorClass(
                        token.priceChange?.h6 ?? 0
                      )}`}
                    >
                      {token.priceChange?.h6 !== undefined
                        ? token.priceChange.h6.toFixed(2)
                        : "N/A"}
                      %
                    </td>
                    <td
                      className={`p-1 sm:p-2 text-right ${getColorClass(
                        token.priceChange?.h24 ?? 0
                      )}`}
                    >
                      {token.priceChange?.h24 !== undefined
                        ? token.priceChange.h24.toFixed(2)
                        : "N/A"}
                      %
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      ${token.volume.h24.toLocaleString()}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      ${token.liquidity.usd.toLocaleString()}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      {token.marketCap
                        ? `$${token.marketCap.toLocaleString()}`
                        : "N/A"}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      {token.fdv
                        ? `$${token.fdv.toLocaleString()}`
                        : "N/A"}
                    </td>
                    <td className="p-1 sm:p-2 text-right">
                      <button
                        onClick={() => handleCopy(token.baseToken.address)}
                        className="bg-gray-700 hover:bg-gray-600 text-xs sm:text-sm text-white py-1 px-2 rounded"
                        title="Copy address"
                      >
                        📋
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Pagination */}
          <div className="flex items-center justify-center py-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded-md transition transform hover:scale-105 disabled:opacity-50 text-xs sm:text-sm"
            >
              &larr; Prev
            </button>
            <span className="mx-2 text-white text-xs sm:text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded-md transition transform hover:scale-105 disabled:opacity-50 text-xs sm:text-sm"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





       