"use client";

import { useState, useEffect } from "react";
import { FiUpload, FiSend, FiCopy, FiTrash2, FiShield, FiCode, FiSearch, FiFileText, FiHelpCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import toast from "react-hot-toast"; // Added for toast notifications

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
    } catch (err: any) {
      const errMsg = err.message || "Error during audit.";
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100 font-sans">
      <Header />
      <div className="flex-grow flex justify-center items-center p-3 sm:p-5">
        <div className="max-w-2xl w-full">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-400 mb-4 sm:mb-6 text-center"> CypherX SmartAudit </h1>

          {/* Input and Buttons */}
          <div className="flex flex-col space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleAudit()}
                placeholder="Enter contract address (e.g., 0x123...) or 'upload'"
                className="w-full px-3 py-2 bg-gray-800 text-gray-200 rounded-lg border border-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm shadow-md placeholder-gray-400"
              />
              <div className="flex space-x-2">
                <label
                  className="flex items-center justify-center text-yellow-400 hover:text-yellow-300 p-2 rounded-full cursor-pointer transition-colors shadow-md hover:bg-yellow-500/20"
                  aria-label="Upload .sol file"
                >
                  <FiUpload className="w-5 h-5" />
                  <input
                    type="file"
                    accept=".sol"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                  className="flex items-center justify-center text-blue-400 hover:text-blue-300 p-2 rounded-full transition-colors disabled:opacity-50 shadow-md hover:bg-blue-500/20"
                  aria-label="Perform audit"
                >
                  <FiSend className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {[
              { icon: FiShield, text: "Secure", color: "text-green-400", hoverColor: "hover:bg-green-500/20" },
              { icon: FiCode, text: "Analyze Code", color: "text-purple-400", hoverColor: "hover:bg-purple-500/20" },
              { icon: FiSearch, text: "Analyze Address", color: "text-blue-400", hoverColor: "hover:bg-blue-500/20" },
              { icon: FiFileText, text: "Audit Report", color: "text-yellow-400", hoverColor: "hover:bg-yellow-500/20" },
              { icon: FiHelpCircle, text: "Help", color: "text-red-400", hoverColor: "hover:bg-red-500/20" },
            ].map(({ icon: Icon, text, color, hoverColor }, idx) => (
              <motion.span
                key={idx}
                className={`flex items-center px-2 py-1 bg-gray-800 text-gray-300 text-sm rounded border border-blue-500/30 ${color} ${hoverColor} cursor-pointer shadow-md`}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                role="button"
                tabIndex={0}
                onClick={() => toast.info(`${text} feature coming soon!`)} // Placeholder action
              >
                <Icon className={`mr-1 w-5 h-5`} /> {text}
              </motion.span>
            ))}
          </div>

          {/* Instructions */}
          <div className="mb-4 sm:mb-6 text-gray-400 text-sm space-y-1">
            <p>Enter a valid Ethereum contract address (e.g., 0x123...) to scan for security issues.</p>
            <p>Or upload a .sol file using the upload button or 'upload' command to analyze the code.</p>
          </div>

          {/* Output Area */}
          <div className="bg-gray-800 p-3 sm:p-5 rounded-lg shadow-md border border-blue-500/30">
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-blue-400 text-sm flex items-center justify-center space-x-2"
                >
                  <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing contract...</span>
                </motion.div>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}
              {auditResult && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-200 space-y-2"
                >
                  <h2 className="text-lg sm:text-xl font-semibold text-blue-400">[ Contract Security Analysis ]</h2>
                  {auditResult.token?.name && (
                    <p className="text-sm">
                      <strong>Token:</strong> {auditResult.token.name}
                    </p>
                  )}
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded text-sm ${
                      auditResult.honeypotResult?.isHoneypot
                        ? "bg-red-500/20 text-red-400"
                        : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {auditResult.honeypotResult?.isHoneypot ? "Possible Scam" : "Contract Secure"}
                  </div>
                  <p className="text-sm">
                    <strong>Status:</strong>{" "}
                    {auditResult.honeypotResult?.isHoneypot ? "Honeypot Detected" : "No Honeypot Detected"}
                  </p>
                  <p className="text-sm">
                    <strong>Risk Level:</strong> {auditResult.summary?.riskLevel || "Low"}
                  </p>
                  <p className="text-sm">
                    <strong>Buy Tax:</strong>{" "}
                    {auditResult.simulationResult?.buyTax !== undefined
                      ? `${auditResult.simulationResult.buyTax}%`
                      : "0.00%"}
                  </p>
                  <p className="text-sm">
                    <strong>Sell Tax:</strong>{" "}
                    {auditResult.simulationResult?.sellTax !== undefined
                      ? `${auditResult.simulationResult.sellTax}%`
                      : "0.00%"}
                  </p>
                  <p className="text-sm">
                    <strong>Blacklisted:</strong> {auditResult.isBlacklisted ? "Yes" : "No"}
                  </p>
                  <p className="text-sm">
                    <strong>Proxy Contract:</strong> {auditResult.isProxy ? "Yes" : "No"}
                  </p>
                  <p className="text-sm">
                    <strong>Fake Token:</strong> {auditResult.isFakeToken ? "Yes" : "No"}
                  </p>
                  <p className="text-sm">
                    <strong>Detailed Analysis:</strong>{" "}
                    {auditResult.detailedAnalysis || "No specific issues detected."}
                  </p>
                  <motion.button
                    onClick={handleCopyResults}
                    className="mt-2 text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1 transition-colors shadow-md hover:bg-yellow-500/20 rounded-md px-2 py-1"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                    aria-label="Copy audit results"
                  >
                    <FiCopy className="w-5 h-5" /> Copy Results
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent Scans */}
          <section className="mt-6 sm:mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-5">
              <h3 className="text-lg sm:text-xl font-semibold text-blue-400">[ Recent Scans ]</h3>
              {auditHistory.length > 0 && (
                <motion.button
                  onClick={handleClearHistory}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition-colors shadow-md hover:bg-red-500/20 rounded-md px-2 py-1 mt-2 sm:mt-0"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                  aria-label="Clear audit history"
                >
                  <FiTrash2 className="w-5 h-5" /> Clear
                </motion.button>
              )}
            </div>
            {auditHistory.length > 0 ? (
              <ul className="space-y-2 sm:space-y-3">
                {auditHistory.map((result, index) => (
                  <li
                    key={index}
                    className="p-2 sm:p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors shadow-md border border-blue-500/30"
                    onClick={() => setAuditResult(result)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e: React.KeyboardEvent<HTMLLIElement>) => e.key === "Enter" && setAuditResult(result)}
                    aria-label={`View audit result for ${result.token?.symbol || "unknown token"}`}
                  >
                    <p className="text-sm">
                      <strong>Token:</strong> {result.token?.symbol || "TKN"} -{" "}
                      <span className={result.honeypotResult?.isHoneypot ? "text-red-400" : "text-green-400"}>
                        {result.honeypotResult?.isHoneypot ? "Honeypot" : "Safe"}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No recent scans.</p>
            )}
          </section>
        </div>
      </div>
      <div className="text-center text-gray-500 text-sm py-2 sm:py-3 border-t border-blue-500/20">
        By using CypherX SmartAudit, you agree to our Terms and Privacy Policy.
      </div>
    </div>
  );
}