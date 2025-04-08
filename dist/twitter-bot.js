"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postWhaleTransaction = postWhaleTransaction;
var twitter_api_v2_1 = require("twitter-api-v2");
var schedule = require("node-schedule");
var dotenv = require("dotenv");
var tokenMapping_1 = require("./tokenMapping"); // Import tokenMapping
// Load environment variables from root
dotenv.config({ path: '../.env' });
// Initialize Twitter client
var client = new twitter_api_v2_1.TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
});
// Static AI token list from BaseAiIndex
var baseAiTokens = [
    { symbol: "GAME", address: "0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3", weight: "4.86%" },
    { symbol: "BANKR", address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", weight: "5.24%" },
    { symbol: "FAI", address: "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935", weight: "12.57%" },
    { symbol: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", weight: "26.8%" },
    { symbol: "CLANKER", address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", weight: "15.89%" },
    { symbol: "KAITO", address: "0x98d0baa52b2D063E780DE12F615f963Fe8537553", weight: "16.22%" },
    { symbol: "COOKIE", address: "0xC0041EF357B183448B235a8Ea73Ce4E4eC8c265F", weight: "5.12%" },
    { symbol: "VVV", address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", weight: "5.08%" },
    { symbol: "DRB", address: "0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2", weight: "3.8%" },
    { symbol: "AIXBT", address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", weight: "10.5%" },
];
// Fetch tokens for TokenScanner (top winners/losers, new listings)
function fetchScannerTokens() {
    return __awaiter(this, void 0, void 0, function () {
        var tokenAddresses, res, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    tokenAddresses = Object.values(tokenMapping_1.tokenMapping).join(",");
                    return [4 /*yield*/, fetch("http://localhost:3000/api/tokens?chainId=base&tokenAddresses=".concat(tokenAddresses))];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error('Failed to fetch scanner tokens');
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, data];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error fetching scanner tokens:', error_1);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Fetch tokens for Base AI Index
function fetchAiIndexTokens() {
    return __awaiter(this, void 0, void 0, function () {
        var addresses, res, data, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    addresses = baseAiTokens.map(function (t) { return t.address; }).join(",");
                    return [4 /*yield*/, fetch("http://localhost:3000/api/tokens?chainId=base&tokenAddresses=".concat(addresses))];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error('Failed to fetch AI index tokens');
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, data];
                case 3:
                    error_2 = _a.sent();
                    console.error('Error fetching AI index tokens:', error_2);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Hourly top winners/losers tweet
function postMarketUpdate() {
    return __awaiter(this, void 0, void 0, function () {
        var tokens, sortedByPriceChange, topWinners, topLosers, winnersText, losersText, tweet, finalTweet, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchScannerTokens()];
                case 1:
                    tokens = _a.sent();
                    if (!tokens.length) {
                        console.log('No tokens for market update');
                        return [2 /*return*/];
                    }
                    sortedByPriceChange = __spreadArray([], tokens, true).sort(function (a, b) { var _a, _b, _c, _d; return ((_b = (_a = b.priceChange) === null || _a === void 0 ? void 0 : _a.h24) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = a.priceChange) === null || _c === void 0 ? void 0 : _c.h24) !== null && _d !== void 0 ? _d : 0); });
                    topWinners = sortedByPriceChange.slice(0, 3);
                    topLosers = sortedByPriceChange.slice(-3).reverse();
                    winnersText = topWinners
                        .map(function (t) { var _a, _b; return "".concat(t.baseToken.symbol, " (").concat((_b = (_a = t.priceChange) === null || _a === void 0 ? void 0 : _a.h24) === null || _b === void 0 ? void 0 : _b.toFixed(2), "%)"); })
                        .join(', ');
                    losersText = topLosers
                        .map(function (t) { var _a, _b; return "".concat(t.baseToken.symbol, " (").concat((_b = (_a = t.priceChange) === null || _a === void 0 ? void 0 : _a.h24) === null || _b === void 0 ? void 0 : _b.toFixed(2), "%)"); })
                        .join(', ');
                    tweet = "Hourly Update:\nTop Winners: ".concat(winnersText, "\nTop Losers: ").concat(losersText, "\n#Web3 #CryptoMarket");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
                    return [4 /*yield*/, client.v2.tweet(finalTweet)];
                case 3:
                    _a.sent();
                    console.log('Market update posted:', finalTweet);
                    return [3 /*break*/, 5];
                case 4:
                    error_3 = _a.sent();
                    console.error('Error posting market update:', error_3);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Daily AI index update tweet
function postAiIndexUpdate() {
    return __awaiter(this, void 0, void 0, function () {
        var tokens, weightedPriceChangeSum, totalWeight, totalVolume, totalMarketCap, overallPriceChange, tweet, finalTweet, error_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetchAiIndexTokens()];
                case 1:
                    tokens = _b.sent();
                    if (!tokens.length) {
                        console.log('No tokens for AI index update');
                        return [2 /*return*/];
                    }
                    weightedPriceChangeSum = 0;
                    totalWeight = 0;
                    totalVolume = 0;
                    totalMarketCap = 0;
                    baseAiTokens.forEach(function (token) {
                        var _a, _b;
                        var weightNum = parseFloat(token.weight.replace("%", ""));
                        var fetched = tokens.find(function (d) { return d.baseToken.address.toLowerCase() === token.address.toLowerCase(); });
                        if (fetched) {
                            if (((_a = fetched.priceChange) === null || _a === void 0 ? void 0 : _a.h24) !== undefined) {
                                weightedPriceChangeSum += weightNum * fetched.priceChange.h24;
                                totalWeight += weightNum;
                            }
                            if ((_b = fetched.volume) === null || _b === void 0 ? void 0 : _b.h24)
                                totalVolume += fetched.volume.h24;
                            if (fetched.marketCap)
                                totalMarketCap += fetched.marketCap;
                        }
                    });
                    overallPriceChange = totalWeight > 0 ? weightedPriceChangeSum / totalWeight : undefined;
                    tweet = "Base AI Index Update:\n24h Change: ".concat((_a = overallPriceChange === null || overallPriceChange === void 0 ? void 0 : overallPriceChange.toFixed(2)) !== null && _a !== void 0 ? _a : 'N/A', "%\nVolume: $").concat(totalVolume.toLocaleString(), "\nMarket Cap: $").concat(totalMarketCap.toLocaleString(), "\n#BaseAI #CryptoIndex");
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
                    return [4 /*yield*/, client.v2.tweet(finalTweet)];
                case 3:
                    _b.sent();
                    console.log('AI index update posted:', finalTweet);
                    return [3 /*break*/, 5];
                case 4:
                    error_4 = _b.sent();
                    console.error('Error posting AI index update:', error_4);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Daily new listings tweet
function postNewListings() {
    return __awaiter(this, void 0, void 0, function () {
        var tokens, newTokens, tweet, finalTweet, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchScannerTokens()];
                case 1:
                    tokens = _a.sent();
                    newTokens = tokens.filter(function (t) { return t.pairCreatedAt && Date.now() - t.pairCreatedAt < 24 * 60 * 60 * 1000; });
                    if (!newTokens.length) {
                        console.log('No new listings to tweet');
                        return [2 /*return*/];
                    }
                    tweet = "New Listings: ".concat(newTokens.map(function (t) { return t.baseToken.symbol; }).join(', '), "\n#NewTokens #Web3");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    finalTweet = tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet;
                    return [4 /*yield*/, client.v2.tweet(finalTweet)];
                case 3:
                    _a.sent();
                    console.log('New listings posted:', finalTweet);
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _a.sent();
                    console.error('Error posting new listings:', error_5);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Whale transaction tweet (placeholder)
function postWhaleTransaction(amount, wallet) {
    return __awaiter(this, void 0, void 0, function () {
        var tweet, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tweet = "Whale Alert: ".concat(amount, " moved by ").concat(wallet, "\n#WhaleWatch #Crypto");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.v2.tweet(tweet)];
                case 2:
                    _a.sent();
                    console.log('Whale tweet posted:', tweet);
                    return [3 /*break*/, 4];
                case 3:
                    error_6 = _a.sent();
                    console.error('Error posting whale alert:', error_6);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Token support announcement
function announceTokenSupport(symbol, address) {
    return __awaiter(this, void 0, void 0, function () {
        var tweet, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tweet = "Token Support for ".concat(symbol, " (").concat(symbol, ") has been added to Homebase.\n\nCA: ").concat(address, "\n#TokenSupport #Homebase");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.v2.tweet(tweet)];
                case 2:
                    _a.sent();
                    console.log('Token support announced:', tweet);
                    return [3 /*break*/, 4];
                case 3:
                    error_7 = _a.sent();
                    console.error('Error announcing token support:', error_7);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Track previously seen tokens
var previousTokens = new Set(Object.keys(tokenMapping_1.tokenMapping));
// Check for new tokens every 5 minutes
function checkForNewTokens() {
    return __awaiter(this, void 0, void 0, function () {
        var currentTokens, newTokens, _i, newTokens_1, symbol, address;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTokens = new Set(Object.keys(tokenMapping_1.tokenMapping));
                    newTokens = __spreadArray([], currentTokens, true).filter(function (token) { return !previousTokens.has(token); });
                    _i = 0, newTokens_1 = newTokens;
                    _a.label = 1;
                case 1:
                    if (!(_i < newTokens_1.length)) return [3 /*break*/, 4];
                    symbol = newTokens_1[_i];
                    address = tokenMapping_1.tokenMapping[symbol];
                    return [4 /*yield*/, announceTokenSupport(symbol, address)];
                case 2:
                    _a.sent();
                    console.log("New token detected: ".concat(symbol));
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    previousTokens = currentTokens; // Update the previous set
                    return [2 /*return*/];
            }
        });
    });
}
// Schedule tasks
schedule.scheduleJob('0 * * * *', postMarketUpdate); // Hourly winners/losers
schedule.scheduleJob('0 0 * * *', postAiIndexUpdate); // Daily AI index at midnight
schedule.scheduleJob('0 12 * * *', postNewListings); // New listings at noon
schedule.scheduleJob('*/5 * * * *', checkForNewTokens); // Check for new tokens every 5 minutes
console.log('Twitter bot started. Schedules active...');
// Test announcement for $DOOG
announceTokenSupport('$DOOG', '0x34b2adb3bd4aef3af0b4541735c47b6364d88d1e');
