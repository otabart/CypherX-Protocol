"use client";

import BlockDetails from "../../../components/BlockDetails.tsx";

interface BlockPageProps {
  params: {
    blockNumber: string;
  };
}

export default function BlockPage({ params }: BlockPageProps) {
  const { blockNumber } = params;

  return <BlockDetails blockNumber={blockNumber} />;
}