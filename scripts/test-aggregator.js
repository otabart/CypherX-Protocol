const { adminDb } = require("../lib/firebase-admin");

async function testAggregator() {
  console.log("🧪 Testing Token Aggregator...");
  
  try {
    // Test Firebase connection
    console.log("📊 Testing Firebase connection...");
    const adminDatabase = adminDb();
    
    if (!adminDatabase) {
      console.log("❌ Firebase admin not initialized");
      return false;
    }
    
    console.log("✅ Firebase connection successful");
    
    // Test basic database operations
    console.log("📊 Testing database operations...");
    const testDoc = adminDatabase.collection("Cypherscope").doc("test");
    
    await testDoc.set({
      address: "0x0000000000000000000000000000000000000000",
      name: "Test Token",
      symbol: "TEST",
      createdAt: new Date(),
      source: "test"
    });
    
    console.log("✅ Database write test successful");
    
    // Clean up test data
    await testDoc.delete();
    console.log("✅ Database cleanup successful");
    
    console.log("🎉 All tests passed! Aggregator is ready to run.");
    return true;
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run the test
testAggregator().then(success => {
  process.exit(success ? 0 : 1);
});
