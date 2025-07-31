// Test script for news API endpoints
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing News API Endpoints...\n');

  try {
    // Test 1: Fetch articles
    console.log('1. Testing GET /api/articles...');
    const articlesResponse = await fetch(`${BASE_URL}/api/articles`);
    const articles = await articlesResponse.json();
    console.log(`✅ Found ${articles.length} articles\n`);

    if (articles.length > 0) {
      const firstArticle = articles[0];
      console.log(`📰 First article: ${firstArticle.title}`);
      console.log(`🔗 Slug: ${firstArticle.slug}\n`);

      // Test 2: Test article interaction (view)
      console.log('2. Testing POST /api/articles/[slug]/interactions (view)...');
      const interactionResponse = await fetch(`${BASE_URL}/api/articles/${firstArticle.slug}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'view',
          userId: 'test-user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
        }),
      });
      
      if (interactionResponse.ok) {
        const result = await interactionResponse.json();
        console.log(`✅ View interaction successful: ${result.pointsEarned} points earned\n`);
      } else {
        const error = await interactionResponse.text();
        console.log(`❌ View interaction failed: ${error}\n`);
      }

      // Test 3: Test article interaction (like)
      console.log('3. Testing POST /api/articles/[slug]/interactions (like)...');
      const likeResponse = await fetch(`${BASE_URL}/api/articles/${firstArticle.slug}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'like',
          userId: 'test-user-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
        }),
      });
      
      if (likeResponse.ok) {
        const result = await likeResponse.json();
        console.log(`✅ Like interaction successful: ${result.pointsEarned} points earned\n`);
      } else {
        const error = await likeResponse.text();
        console.log(`❌ Like interaction failed: ${error}\n`);
      }

      // Test 4: Test user stats
      console.log('4. Testing GET /api/user/stats...');
      const statsResponse = await fetch(`${BASE_URL}/api/user/stats?walletAddress=0x1234567890123456789012345678901234567890`);
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        console.log(`✅ User stats retrieved: ${stats.stats.points} points, rank #${stats.stats.rank}\n`);
      } else {
        const error = await statsResponse.text();
        console.log(`❌ User stats failed: ${error}\n`);
      }

      // Test 5: Test leaderboard
      console.log('5. Testing GET /api/leaderboard...');
      const leaderboardResponse = await fetch(`${BASE_URL}/api/leaderboard?top=5`);
      
      if (leaderboardResponse.ok) {
        const leaderboard = await leaderboardResponse.json();
        console.log(`✅ Leaderboard retrieved: ${leaderboard.leaderboard.length} users\n`);
        if (leaderboard.leaderboard.length > 0) {
          console.log(`🏆 Top user: ${leaderboard.leaderboard[0].walletAddress} with ${leaderboard.leaderboard[0].points} points\n`);
        }
      } else {
        const error = await leaderboardResponse.text();
        console.log(`❌ Leaderboard failed: ${error}\n`);
      }

      // Test 6: Test user activities
      console.log('6. Testing GET /api/user-activities...');
      const activitiesResponse = await fetch(`${BASE_URL}/api/user-activities?walletAddress=0x1234567890123456789012345678901234567890&limit=5`);
      
      if (activitiesResponse.ok) {
        const activities = await activitiesResponse.json();
        console.log(`✅ User activities retrieved: ${activities.activities.length} activities\n`);
      } else {
        const error = await activitiesResponse.text();
        console.log(`❌ User activities failed: ${error}\n`);
      }

    } else {
      console.log('⚠️  No articles found. Please run the sample data script first.\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('🏁 API testing completed!');
}

// Run the test
testAPI(); 