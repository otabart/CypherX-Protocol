"use client";

import React, { useEffect, useState } from "react";

// Define token type
interface Token {
  name: string;
  address: string;
}

// Define pool mapping type
interface PoolMapping {
  [key: string]: {
    poolAddress: string | null;
    pair: string | null;
  };
}

const tokens: Token[] = [
  { name: "SKITTEN", address: "0x4B6104755AfB5Da4581B81C552DA3A25608c73B8" },
  { name: "RUNNER", address: "0x18b6f6049A0af4Ed2BBe0090319174EeeF89f53a" },
  { name: "FARTCOIN", address: "0x2f6c17fa9f9bC3600346ab4e48C0701e1d5962AE" },
  { name: "SEKOIA", address: "0x1185cB5122Edad199BdBC0cbd7a0457e448f23c7" },
  { name: "SKICAT", address: "0xA6f774051dFb6b54869227fDA2DF9cb46f296c09" },
  { name: "KEYCAT", address: "0x9a26F5433671751C3276a065f57e5a02D2817973" },
  { name: "LUNA", address: "0x55cD6469F597452B5A7536e2CD98fDE4c1247ee4" },
  { name: "DOGINME", address: "0x6921B130D297cc43754afba22e5EAc0FBf8Db75b" },
  { name: "TURBO", address: "0xBA5E66FB16944Da22A62Ea4FD70ad02008744460" },
  { name: "PEPE", address: "0x52b492a33E447Cdb854c7FC19F1e57E8BfA1777D" },
  { name: "NATIVE", address: "0x20DD04c17AFD5c9a8b3f2cdacaa8Ee7907385BEF" },
  { name: "FAI", address: "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935" },
  { name: "AGENT", address: "0xF5Bc3439f53A45607cCaD667AbC7DAF5A583633F" },
  { name: "MOJO", address: "0x6dba065721435cfCa05CAa508f3316B637861373" },
  { name: "A1C", address: "0x1F1c695f6b4A3F8B05f2492ceF9474Afb6d6Ad69" },
  { name: "BENJI", address: "0xBC45647eA894030a4E9801Ec03479739FA2485F0" },
  { name: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b" },
  { name: "TOBY", address: "0xb8D98a102b0079B69FFbc760C8d857A31653e56e" },
  { name: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" },
  { name: "MIGGLES", address: "0xB1a03EdA10342529bBF8EB700a06C60441fEf25d" },
  { name: "POLY", address: "0x2676E4e0E2eB58D9Bdb5078358ff8A3a964CEdf5" },
  { name: "AIXBT", address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825" },
  { name: "AMEN", address: "0xeB476e9aB6B1655860b3F40100678D0c1ceDB321" },
  { name: "HIGHER", address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe" },
  { name: "ACOLYTE", address: "0x79dacb99A8698052a9898E81Fdf883c29efb93cb" },
  { name: "CLANKER", address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb" },
  { name: "SKI", address: "0x768BE13e1680b5ebE0024C42c896E3dB59ec0149" },
  { name: "EAI", address: "0x6797B6244fA75F2e78cDFfC3a4eb169332b730cc" },
  { name: "OX", address: "0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea" },
  { name: "CHAOS", address: "0x20d704099B62aDa091028bcFc44445041eD16f09" },
  { name: "BLEP", address: "0xC438B0c0E80A8Fa1B36898d1b36A3fc2eC371C54" },
  { name: "DKING", address: "0x57eDc3F1fd42c0d48230e964b1C5184B9c89B2ed" },
  { name: "KEVIN", address: "0xD461A534AF11EF58E9F9add73129a1f45485A8dc" },
  { name: "BSOP", address: "0x9704d2adBc02C085ff526a37ac64872027AC8a50" },
  { name: "FROC", address: "0x3C8cd0dB9a01EfA063a7760267b822A129bc7DCA" },
  { name: "EOLAS", address: "0xF878e27aFB649744EEC3c5c0d03bc9335703CFE3" },
  { name: "CLIZA", address: "0x290f057a2c59b95d8027aa4abf31782676502071" },
  { name: "$MRKT", address: "0x2133031F5aCbC493572c02f271186F241cd8D6a5" },
  { name: "AMPS.FUN", address: "0x1B23819885FcE964A8B39D364b7462D6E597ae8e" },
  { name: "KTA", address: "0xc0634090F2Fe6c6d75e61Be2b949464aBB498973" },
  { name: "AIP", address: "0x02D4f76656C2B4f58430e91f8ac74896c9281Cb9" },
  { name: "BNKR", address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b" },
  { name: "MUSIC", address: "0xc655C331d1Aa7f96c252F1f40CE13D80eAc53504" },
  { name: "NFTXBT", address: "0x08c81699F9a357a9F0d04A09b353576ca328d60D" },
  { name: "RSC", address: "0xFbB75A59193A3525a8825BeBe7D4b56899E2f7e1" },
  { name: "ANDY", address: "0x18A8BD1fe17A1BB9FFB39eCD83E9489cfD17a022" },
  { name: "AEROBUD", address: "0xFad8CB754230dbFd249Db0E8ECCb5142DD675a0d" },
  { name: "BSWAP", address: "0x78a087d713Be963Bf307b18F2Ff8122EF9A63ae9" },
  { name: "BEPE", address: "0x10f434B3d1cC13A4A79B062Dcc25706f64D10D47" },
  { name: "BID", address: "0xa1832f7F4e534aE557f9B5AB76dE54B1873e498B" },
  { name: "MOEW", address: "0x15aC90165f8B45A80534228BdCB124A011F62Fee" },
  { name: "BRACKY", address: "0xE3086852A4B125803C815a158249ae468A3254Ca" },
  { name: "AIFUN", address: "0xbDF317F9C153246C429F23f4093087164B145390" },
  { name: "DREAM", address: "0x98D59767CD1335071A4E9b9d3482685C915131E8" },
  { name: "CHOMP", address: "0xebfF2db643Cf955247339c8c6bCD8406308ca437" },
  { name: "ZUZALU", address: "0x3054E8F8fBA3055a42e5F5228A2A4e2AB1326933" },
  { name: "DICKBUTT", address: "0x2D57C47BC5D2432fEEEdf2c9150162A9862D3cCf" },
  { name: "OTTO", address: "0x62Ff28a01AbD2484aDb18C61f78f30Fb2E4A6fDb" },
  { name: "SKOP", address: "0x6d3B8C76c5396642960243Febf736C6BE8b60562" },
  { name: "PEEZY", address: "0x1b6A569DD61EdCe3C383f6D565e2f79Ec3a12980" },
  { name: "CREATE", address: "0x3849cC93e7B71b37885237cd91a215974135cD8D" },
  { name: "BASE", address: "0xd07379a755A8f11B57610154861D694b2A0f615a" },
  { name: "RFL", address: "0x6e2c81b6c2C0e02360F00a0dA694e489acB0b05e" },
  { name: "FABIENNE", address: "0x62D0B7ea8AA059f0154692435050cecedf8D3e99" },
  { name: "NORMILIO", address: "0xcDE90558fc317C69580DeeAF3eFC509428Df9080" },
  { name: "SIM", address: "0x749e5334752466CdA899B302ed4176B8573dC877" },
  { name: "PARADOX", address: "0x3c4b6Cd7874eDc945797123fcE2d9a871818524b" },
  { name: "TN100X", address: "0x5B5dee44552546ECEA05EDeA01DCD7Be7aa6144A" },
  { name: "MISATO", address: "0x98f4779FcCb177A6D856dd1DfD78cd15B7cd2af5" },
  { name: "COCORO", address: "0x937a1cFAF0A3d9f5Dc4D0927F72ee5e3e5F82a00" },
  { name: "DRB", address: "0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2" },
  { name: "GRK", address: "0x2E2cc4dfce60257F091980631e75f5c436b71C87" },
  { name: "OCTO", address: "0x41A188B74ffBcEa2BD548644853d26Ab0755CDB9" },
  { name: "PAWS", address: "0x0Acb8f6a6f1a8DF2b4846db0352cAaA01d854bF8" },
  { name: "DRAI", address: "0x2bc08A6583F9bb980f26114c6B513252942E946F" },
  { name: "AGIXBT", address: "0x81496f85abaf8bd2e13d90379fde86c533d8670d" },
  { name: "VVV", address: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf" },
  { name: "$public", address: "0x3a1609cebe67c1d303954b5fb907bef36213034b" },
  { name: "VEIL", address: "0x767a739d1a152639e9ea1d8c1bd55fdc5b217d7f" },
  { name: "VADER", address: "0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870" },
  { name: "CROW", address: "0x2efb2110f352fc98cd39dc041887c41766dbb301" },
  { name: "SKYA", address: "0x623cd3a3edf080057892aaf8d773bbb7a5c9b6e9" },
  { name: "DIME", address: "0x17d70172c7c4205bd39ce80f7f0ee660b7dc5a23" },
  { name: "SAINT", address: "0x7588880d9c78e81fade7b7e8dc0781e95995a792" },
  { name: "TIMI", address: "0x9beec80e62aa257ced8b0edd8692f79ee8783777" },
  { name: "MORPHO", address: "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842" },
  { name: "ANZ", address: "0xeec468333ccc16d4bf1cef497a56cf8c0aae4ca3" },
  { name: "MUNCHI", address: "0x5dc232b8301e34efe2f0ea2a5a81da5b388bb45e" },
  { name: "LUM", address: "0x0fd7a301b51d0a83fcaf6718628174d527b373b6" },
  { name: "QR", address: "0x2b5050f01d64fbb3e4ac44dc07f0732bfb5ecadf" },
  { name: "drai", address: "0x2bc08A6583F9bb980f26114c6B513252942E946F" }, // Duplicate name, same address as DRAI
  { name: "MAVIA", address: "0x24fcfc492c1393274b6bcd568ac9e225bec93584" },
  { name: "KAITO", address: "0x98d0baa52b2d063e780de12f615f963fe8537553" },
  { name: "BAGY", address: "0xb964c6bfa06894e91f008a4d2b3a2bad379462e4" },
  { name: "AKUMA", address: "0x2f20cf3466f80a5f7f532fca553c8cbc9727fef6" },
  { name: "GAME", address: "0x1c4cca7c5db003824208adda61bd749e55f463a3" },
  { name: "$COOL", address: "0x3080ce06eee2869e1b0287ad0de73f9421f977a3" },
  { name: "COOKIE", address: "0xc0041ef357b183448b235a8ea73ce4e4ec8c265f" },
  { name: "BTCB", address: "0x0c41f1fc9022feb69af6dc666abfe73c9ffda7ce" },
  { name: "LINGO", address: "0xfb42da273158b0f642f59f2ba7cc1d5457481677" },
  { name: "ROCKY", address: "0x3636a7734b669ce352e97780df361ce1f809c58c" },
  { name: "HORSE", address: "0xf1fc9580784335b2613c1392a530c1aa2a69ba3d" },
  { name: "DACKIE", address: "0x73326b4d0225c429bed050c11c4422d91470aaf4" },
  { name: "GOCHU", address: "0x9aaae745cf2830fb8ddc6248b17436dc3a5e701c" },
  { name: "MOR", address: "0x7431ada8a591c955a994a21710752ef9b882b8e3" },
  { name: "H4CK", address: "0x625bb9bb04bdca51871ed6d07e2dd9034e914631" },
  { name: "lemon3", address: "0xe0907762B1D9cdfBE8061aE0Cc4A0501fa077421" },
  { name: "heir", address: "0x01e75e59Eabf83C85360351a100d22E025A75BC2" },
  { name: "BNXR", address: "0x04175B1f982b8C8444f238Ac0AaE59f029e21099" },
  { name: "IXA", address: "0x215d3783a05D9059220E76aA92c6Fd86ed67bFDB" },
  { name: "CLNKVTX", address: "0xdc7F7Ad44f3Ed116577417017cf37a19DFf9FFe9" },
  { name: "AGNT", address: "0x521eBB84EA82eE65154B68EcFE3a7292fb3779D6" },
  { name: "$checkr", address: "0x2EFAc0a597A37050AafcF4beC627249D533DD9f8" },
  { name: "BORK", address: "0x3155dadAF7324c79DF418a11EBDF78F926cDef91" },
  { name: "4", address: "0x3a7FdAFFCEc305b7c5dbab618dcE8bE2c97B6Ec5" },
  { name: "BOBR", address: "0x2531ec1720E5d1bC82052585271D4BE3f43E392F" },
  { name: "GRAI", address: "0x3D9DC963706FC7F60C81362D9817B00871968Cb7" },
  { name: "CYBER", address: "0xE68C6c552A2363C0B546EDA749C6eadd909e2831" },
];

export default function FetchPoolIds() {
  const [poolMap, setPoolMap] = useState<PoolMapping>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchPoolIds() {
    setLoading(true);
    setError(null);
    const newPoolMap: PoolMapping = {};

    for (const token of tokens) {
      try {
        const response = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/base/tokens/${token.address}/pools`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          // Pick the first pool (e.g., highest liquidity or WETH pair)
          const pool = data.data[0];
          newPoolMap[token.name] = {
            poolAddress: pool.attributes.address,
            pair: `${pool.relationships.base_token.data.id.split("_")[1]}/${pool.relationships.quote_token.data.id.split("_")[1]}`,
          };
          console.log(`${token.name}: Pool ID = ${pool.attributes.address}, Pair = ${newPoolMap[token.name].pair}`);
        } else {
          console.log(`${token.name}: No pools found`);
          newPoolMap[token.name] = { poolAddress: null, pair: null };
        }
      } catch (err) {
        console.error(`${token.name}: Error fetching pools - ${err instanceof Error ? err.message : err}`);
        newPoolMap[token.name] = { poolAddress: null, pair: null };
      }
    }

    setPoolMap(newPoolMap);
    setLoading(false);
  }

  useEffect(() => {
    fetchPoolIds();
  }, []);

  return (
    <div className="p-4 bg-black text-white font-mono">
      <h1 className="text-2xl font-bold mb-4">Fetch Pool IDs</h1>
      {loading ? (
        <p>Loading pool IDs...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div>
          <h2 className="text-xl mb-2">Pool Mapping</h2>
          <pre className="bg-gray-800 p-4 rounded overflow-auto max-h-[600px]">
            {JSON.stringify(poolMap, null, 2)}
          </pre>
          <button
            onClick={fetchPoolIds}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Refresh Pool IDs
          </button>
        </div>
      )}
    </div>
  );
}