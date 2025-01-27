// app/api/analytics/route.js

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const query = searchParams.get('query');
  
    // Mock data
    const mockData = {
      transactionTrends: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [
          {
            label: 'Transactions',
            data: [200, 250, 300, 400, 350, 500, 450],
            borderColor: '#0052FF',
            backgroundColor: 'rgba(0, 82, 255, 0.3)',
            fill: true,
          },
        ],
      },
      gasFees: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [
          {
            label: 'Gas Fees (Gwei)',
            data: [50, 60, 45, 80, 70, 90, 85],
            borderColor: '#FF5722',
            backgroundColor: 'rgba(255, 87, 34, 0.3)',
            fill: true,
          },
        ],
      },
      activeWallets: 56789,
      transactionsPerSecond: 120,
      averageBlockTime: '13.2s',
    };
  
    return new Response(JSON.stringify(mockData), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  