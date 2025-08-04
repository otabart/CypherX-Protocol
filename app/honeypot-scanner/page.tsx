"use client";

import { useState, useEffect } from "react";
import { 
  FiUpload, 
  FiSend, 
  FiCopy, 
  FiTrash2, 
  FiShield, 
  FiCode, 
  FiSearch, 
  FiFileText, 
  FiHelpCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiActivity,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiRefreshCw,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import toast from "react-hot-toast";

interface AuditResult {
  token?: { name?: string; symbol?: string };
  honeypotResult?: { isHoneypot?: boolean; honeypotReason?: string };
  summary?: { risk?: string; riskLevel?: string; flags?: string[] };
  simulationResult?: { buyTax?: number; sellTax?: number };
  isBlacklisted?: boolean;
  isProxy?: boolean;
  isFakeToken?: boolean;
  detailedAnalysis?: string;
  totalSupply?: number;
  holderCount?: number;
  liquidityPool?: string;
  contractAgeDays?: number;
}

export default function SmartAuditPage() {
  const [input, setInput] = useState("");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([]);


  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("auditHistory") || "[]");
    setAuditHistory(history);
  }, []);

  const isValidAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  const performAudit = async (inputType: "address" | "file", data?: string | File): Promise<AuditResult | null> => {
    setLoading(true);
    setError(null);
    setAuditResult(null);

    try {
      let response: AuditResult;
      if (inputType === "address" && typeof data === "string") {
        const honeypotResponse = await fetch(`/api/honeypot/scan?address=${data}`);
        if (!honeypotResponse.ok) throw new Error(await honeypotResponse.text());
        response = await honeypotResponse.json();
      } else if (inputType === "file" && data instanceof File) {
        const formData = new FormData();
        formData.append("file", data);
        const [command, arg] = input.toLowerCase().split(/\s+/);
        if (command === "audit" && arg && isValidAddress(arg)) formData.append("address", arg);
        else if (isValidAddress(input)) formData.append("address", input);
        const res = await fetch("/api/honeypot/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        response = await res.json();
      } else throw new Error("Invalid audit request.");

      const newHistory = [response, ...auditHistory].slice(0, 5);
      setAuditHistory(newHistory);
      localStorage.setItem("auditHistory", JSON.stringify(newHistory));
      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error during audit.";
      setError(errMsg);
      toast.error(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!input.trim()) return;

    let command = input.toLowerCase().trim();
    let arg = "";

    if (isValidAddress(input)) {
      command = "audit";
      arg = input;
    } else [command, arg] = input.toLowerCase().split(/\s+/);

    if (command === "audit" && arg && isValidAddress(arg)) {
      const result = await performAudit("address", arg);
      setAuditResult(result);
    } else if (command === "upload") {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".sol";
      fileInput.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file && file.type === "application/octet-stream" && file.name.endsWith(".sol")) {
          const result = await performAudit("file", file);
          setAuditResult(result);
        } else {
          const errMsg = "Please upload a valid .sol file.";
          setError(errMsg);
          toast.error(errMsg);
        }
      };
      fileInput.click();
    } else {
      const errMsg = "Invalid command. Use 'audit 0x123...' or 'upload'.";
      setError(errMsg);
      toast.error(errMsg);
    }
    setInput("");
  };

  const handleCopyResults = () => {
    if (!auditResult) return;
    const resultText = `
      Token Name: ${auditResult.token?.name || "Unnamed"}
      Token Symbol: ${auditResult.token?.symbol || "TKN"}
      Status: ${auditResult.honeypotResult?.isHoneypot ? "Honeypot Detected" : "No Honeypot Detected"}
      Buy Tax: ${auditResult.simulationResult?.buyTax !== undefined ? `${auditResult.simulationResult.buyTax}%` : "0.00%"}
      Sell Tax: ${auditResult.simulationResult?.sellTax !== undefined ? `${auditResult.simulationResult.sellTax}%` : "0.00%"}
      Risk Level: ${auditResult.summary?.riskLevel || "Low"}
      Blacklisted: ${auditResult.isBlacklisted ? "Yes" : "No"}
      Proxy Contract: ${auditResult.isProxy ? "Yes" : "No"}
      Fake Token: ${auditResult.isFakeToken ? "Yes" : "No"}
      Detailed Analysis: ${auditResult.detailedAnalysis || "No analysis available."}
    `.trim();
    navigator.clipboard.writeText(resultText);
    toast.success("Scan results copied to clipboard!");
  };

  const handleClearHistory = () => {
    setAuditHistory([]);
    localStorage.setItem("auditHistory", JSON.stringify([]));
    toast.success("Audit history cleared!");
  };

  const getRiskColor = (riskLevel?: string) => {
    if (!riskLevel || typeof riskLevel !== 'string') {
      return "text-gray-400 bg-gray-900/30 border-gray-500/30";
    }
    
    switch (riskLevel.toLowerCase()) {
      case "high":
        return "text-red-400 bg-red-900/30 border-red-500/30";
      case "medium":
        return "text-yellow-400 bg-yellow-900/30 border-yellow-500/30";
      case "low":
        return "text-green-400 bg-green-900/30 border-green-500/30";
      default:
        return "text-gray-400 bg-gray-900/30 border-gray-500/30";
    }
  };

  const getStatusIcon = (isHoneypot?: boolean) => {
    if (isHoneypot) {
      return <FiXCircle className="w-6 h-6 text-red-400" />;
    }
    return <FiCheckCircle className="w-6 h-6 text-green-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 flex items-center justify-center flex-col sm:flex-row">
              <FiShield className="w-6 h-6 sm:w-8 sm:h-8 mr-0 sm:mr-3 mb-2 sm:mb-0 text-blue-400" />
              CypherX SmartAudit
            </h1>
            <p className="text-gray-400 text-sm sm:text-base px-4">Advanced blockchain security analysis and honeypot detection</p>
          </div>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8"
        >
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAudit()}
                  placeholder="Enter contract address (e.g., 0x123...) or 'upload'"
                  className="w-full pl-10 pr-4 py-3 sm:py-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-3 sm:py-4 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors cursor-pointer min-h-[48px]">
                <FiUpload className="w-5 h-5" />
                <span className="text-sm sm:text-base font-medium">Upload .sol</span>
                <input
                  type="file"
                  accept=".sol"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type === "application/octet-stream" && file.name.endsWith(".sol")) {
                      performAudit("file", file).then(setAuditResult);
                    } else {
                      const errMsg = "Please upload a valid .sol file.";
                      setError(errMsg);
                      toast.error(errMsg);
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleAudit}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 sm:py-4 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] font-medium"
              >
                {loading ? (
                  <FiRefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <FiSend className="w-5 h-5" />
                )}
                <span className="text-sm sm:text-base">{loading ? "Analyzing..." : "Analyze"}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>Enter a valid Ethereum contract address to scan for security issues, or upload a .sol file for code analysis.</p>
          </div>
        </motion.div>

        {/* Results Section - Moved here to appear under search */}
        <AnimatePresence>
          {auditResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 sm:space-y-6 mb-6 sm:mb-8"
            >
              {/* Main Result Card */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                    <FiShield className="w-5 h-5 text-blue-400" />
                    Security Analysis Results
                  </h2>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(auditResult.honeypotResult?.isHoneypot)}
                    <span className={`inline-flex items-center px-3 py-2 rounded-full text-xs sm:text-sm font-medium border ${
                      auditResult.honeypotResult?.isHoneypot 
                        ? "bg-red-900/30 text-red-400 border-red-500/30" 
                        : "bg-green-900/30 text-green-400 border-green-500/30"
                    }`}>
                      {auditResult.honeypotResult?.isHoneypot ? "Honeypot Detected" : "Contract Secure"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Token Name</span>
                      <span className="text-white font-medium text-sm sm:text-base">{auditResult.token?.name || "Unnamed"}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Token Symbol</span>
                      <span className="text-white font-medium text-sm sm:text-base">{auditResult.token?.symbol || "TKN"}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Risk Level</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(auditResult.summary?.riskLevel)}`}>
                        {auditResult.summary?.riskLevel || "Low"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Status</span>
                      <span className={`text-xs sm:text-sm ${auditResult.honeypotResult?.isHoneypot ? "text-red-400" : "text-green-400"}`}>
                        {auditResult.honeypotResult?.isHoneypot ? "Honeypot Detected" : "No Honeypot Detected"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Buy Tax</span>
                      <div className="flex items-center gap-2">
                        <FiTrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-white font-medium text-sm sm:text-base">
                          {auditResult.simulationResult?.buyTax !== undefined ? `${auditResult.simulationResult.buyTax}%` : "0.00%"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Sell Tax</span>
                      <div className="flex items-center gap-2">
                        <FiTrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-white font-medium text-sm sm:text-base">
                          {auditResult.simulationResult?.sellTax !== undefined ? `${auditResult.simulationResult.sellTax}%` : "0.00%"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Blacklisted</span>
                      <span className={`text-xs sm:text-sm ${auditResult.isBlacklisted ? "text-red-400" : "text-green-400"}`}>
                        {auditResult.isBlacklisted ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-gray-700/30 rounded-lg">
                      <span className="text-gray-400 text-sm">Proxy Contract</span>
                      <span className={`text-xs sm:text-sm ${auditResult.isProxy ? "text-yellow-400" : "text-green-400"}`}>
                        {auditResult.isProxy ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white">Detailed Analysis</h3>
                    <button
                      onClick={handleCopyResults}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
                    >
                      <FiCopy className="w-4 h-4" />
                      Copy Results
                    </button>
                  </div>
                  <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                    {auditResult.detailedAnalysis || "No specific issues detected in this contract."}
                  </p>
                </div>
              </div>

              
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6 sm:mb-8"
        >
          {[
            { icon: FiShield, text: "Security Scan", color: "bg-green-500/20 border-green-500/30 text-green-400" },
            { icon: FiCode, text: "Code Analysis", color: "bg-purple-500/20 border-purple-500/30 text-purple-400" },
            { icon: FiSearch, text: "Address Check", color: "bg-blue-500/20 border-blue-500/30 text-blue-400" },
            { icon: FiFileText, text: "Audit Report", color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" },
            { icon: FiHelpCircle, text: "Help Guide", color: "bg-red-500/20 border-red-500/30 text-red-400" },
          ].map(({ icon: Icon, text, color }, idx) => (
            <motion.button
              key={idx}
              className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg border ${color} hover:scale-105 transition-transform min-h-[80px]`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => toast(`${text} feature coming soon!`, { icon: 'ℹ️' })}
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs sm:text-sm font-medium text-center">{text}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400"
            >
              <div className="flex items-center gap-2">
                <FiAlertTriangle className="w-5 h-5" />
                Error: {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Scans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
             <h3 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
               <FiClock className="w-5 h-5 text-blue-400" />
               Recent Scans
             </h3>
             {auditHistory.length > 0 && (
               <button
                 onClick={handleClearHistory}
                 className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm text-white transition-colors"
               >
                 <FiTrash2 className="w-4 h-4" />
                 <span className="hidden sm:inline">Clear History</span>
                 <span className="sm:hidden">Clear</span>
               </button>
             )}
           </div>

           {auditHistory.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {auditHistory.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer"
                  onClick={() => setAuditResult(result)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium">{result.token?.symbol || "TKN"}</span>
                    {getStatusIcon(result.honeypotResult?.isHoneypot)}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Status</span>
                      <span className={result.honeypotResult?.isHoneypot ? "text-red-400" : "text-green-400"}>
                        {result.honeypotResult?.isHoneypot ? "Honeypot" : "Safe"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Risk</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getRiskColor(result.summary?.riskLevel)}`}>
                        {result.summary?.riskLevel || "Low"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Buy Tax</span>
                      <span className="text-white">
                        {result.simulationResult?.buyTax !== undefined ? `${result.simulationResult.buyTax}%` : "0%"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FiActivity className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No recent scans</p>
              <p className="text-gray-500 text-sm mt-2">Start by analyzing a contract address</p>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}