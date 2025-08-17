"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import LoadingPage from "./LoadingPage";
import PageLoader from "./PageLoader";

interface LoadingContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setPageLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};

export { PageLoader };

interface LoadingProviderProps {
  children: React.ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  // Initial app loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Show loading for 2 seconds on initial load

    return () => clearTimeout(timer);
  }, []);

  // Handle page loading
  useEffect(() => {
    if (pageLoading) {
      const timer = setTimeout(() => {
        setPageLoading(false);
      }, 1000); // Show page loading for 1 second

      return () => clearTimeout(timer);
    }
  }, [pageLoading]);

  const value = {
    isLoading: isLoading || pageLoading,
    setIsLoading,
    setPageLoading,
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};
