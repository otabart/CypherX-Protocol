const { execSync } = require('child_process');

console.log('Deploying updated Firestore rules...');

try {
  // Deploy only the Firestore rules
  execSync('firebase deploy --only firestore:rules', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ Firestore rules deployed successfully!');
} catch (error) {
  console.error('❌ Failed to deploy Firestore rules:', error.message);
  console.log('\nYou can also deploy manually by running:');
  console.log('firebase deploy --only firestore:rules');
}
