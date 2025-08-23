import admin from 'firebase-admin';

// Initialize Firebase Admin with the provided credentials
const initializeAdmin = () => {
  try {
    console.log("Starting Firebase Admin initialization...");
    
    const serviceAccount = {
      type: "service_account",
      project_id: "homebase-dapp",
      private_key_id: "firebase-adminsdk-fbsvc@homebase-dapp.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCnNLSL8rEfUnxM\nexDSfs7h68fw41ap32HiPhyit1IiN6CewJSY+fXMKADGyJsRTVVjsnL0P8SDbEi9\nU6hqGFrCpkKS/x6GCyo3gRf5EbHsNvMJlX5GQ2vaGrLGaWaSYkdXr7U9H76zhird\nWfq1bSV6MdvmCBoMdP8gtiJCrrlDRpFoDeGLyV9R0xY1vdB1IlhPBDb4SzNel6fO\nhfGF8NSzu9u8ufHbobXXCmEqzQCqzOkS2imwL7wGJpRFHsVd6ieUDJGDuzU000PL\nTeSy749im2qvLvX64ctPtd8/QvzEOkv5M5oc9LV2z5okS3RyLgJAF5VQ4/Qe/SYk\njSOivExfAgMBAAECggEACGxVyhUMSjUoENxEQS5lMqljlaWGOKGJt1GEtMfCafne\nbBDsi3ZQJRxAycLSWQFJ029qbhaGSk6arXr46XtXmyWwBeK3QW5vjoNA12nGSk2M\nWce/qD9+P+sHZYpqweYUjPzLhwxB2Z5hK2x8fkZE1I6Nct2mnkkIjzfNqwlNSO/A\nqmD+g6qkb1rlzib46jPc5TDuav9nfYO0m4Gfpgh3kmNTj/nq/9IdUpYAC79f7+AX\nraQJVmWEq3z4Nj6C9PlnIZAKFEWVRFQrIVDDOJy4JD8Ru7dtuOH8QnxaUhpXBK8h\nuGZHMEsqN4wUznW26/vjeePhgrF8zDbbY0XTPumXmQKBgQDnfoAXWZ7dygTHxMEV\n8s2++Tdt9oSgduRKOzOmo7h0jm5QO9wm7HTjdl/Um5da4mW2rNx/C5+bmB7PIAC/\nUKWegQ5hiHHVzxp1N22DLcJ9DIM+LxmBPDKp4HKOfCe06SocjtfYPjdc3Utik/yA\n5/MXihQfZUDeq+SQ2s70XVNr9wKBgQC45/2cjQgIBlOCMh5+A5Gnj0VaKxRs6qHL\nC9cbfohtkktC5ulFRlJhCV6MlDeSYNhwzOjFZkU3pxbf/wcOWYoondDkjJ+sF30Q\nrqLjcvVqqFk7Xa6acbWEQyI4ftHXJhJw+ToZDw8IwVljI2awGmSFOkUbOyetwyUF\nPxp02GZ42QKBgD+XZXKEoPqGK0gBSZVQ7KoAZfSkGozF/DJUDv1AzkPeeHk76F8c\n54MwmmSaFTrXJF/JHo0b0U15vUTiorHrYoOnKh8qzzKPwNHgVwoJAPs++7KSV6xD\nsBswV+fCPVoaDwJnTu3NMYImHDZJNrzmesXFnX9+XhKNH62XHfDMzkTDAoGBAK9G\n2lWIKtDQjmCged8iKvQXD7rFk3sbf3smIiZh75lOUCF/Gikc3AI4C3RfG76aJxHm\na9CTfZGfxkNXUKz9m8Wcs+OymblcGqWxpZ7N3m3YX52y1Ex69YIG0W2Uaf30jQ6i\ncbxHVg0Km10qtbDBk//mmJOTo61HitRKWR3h9GEhAoGBAKuOmsp10nx1l3k0G2ay\nHm0PHbSf2XsgVO23Z0YFCEfEmPv/0zBO3V5jpBap95LJQ364Ym1T+yUYBLbws+Hc\nMPgaDmMGyYPDGzk+qNq/N6PHDbnNNsW2/M3QvBQeh4+SUSoPVZRvcTlUoETmGaWL\nHmrnws4R0WfRgTR7w4hsjNjT\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-fbsvc@homebase-dapp.iam.gserviceaccount.com",
      client_id: "492562110747",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40homebase-dapp.iam.gserviceaccount.com"
    };
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "homebase-dapp"
      });
    }
    
    console.log("Successfully initialized Firebase Admin");
    return admin.firestore();
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    throw error;
  }
};

const db = initializeAdmin();

async function checkAuthorStatus() {
  try {
    console.log('Checking author status...');
    
    const adminEmail = 'homebasemarkets@gmail.com';
    
    // Check users collection
    const usersQuery = await db.collection('users').where('email', '==', adminEmail).get();
    
    if (!usersQuery.empty) {
      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      
      console.log('=== USER DATA ===');
      console.log('User ID:', userDoc.id);
      console.log('Email:', userData.email);
      console.log('Wallet Address:', userData.walletAddress);
      console.log('Is Author:', userData.isAuthor);
      console.log('Author Status:', userData.authorStatus);
      console.log('Alias:', userData.alias);
      console.log('Twitter Handle:', userData.twitterHandle);
    } else {
      console.log('No user found with email:', adminEmail);
    }
    
    // Check authors collection
    const authorsQuery = await db.collection('authors').where('email', '==', adminEmail).get();
    
    if (!authorsQuery.empty) {
      const authorDoc = authorsQuery.docs[0];
      const authorData = authorDoc.data();
      
      console.log('\n=== AUTHOR DATA ===');
      console.log('Author ID:', authorDoc.id);
      console.log('Email:', authorData.email);
      console.log('Wallet Address:', authorData.walletAddress);
      console.log('Status:', authorData.status);
      console.log('Alias:', authorData.alias);
      console.log('Twitter Handle:', authorData.twitterHandle);
    } else {
      console.log('No author record found with email:', adminEmail);
    }
    
    // Check articles
    const articlesSnapshot = await db.collection('articles').limit(3).get();
    console.log('\n=== SAMPLE ARTICLES ===');
    articlesSnapshot.docs.forEach((doc, index) => {
      const articleData = doc.data();
      console.log(`Article ${index + 1}:`);
      console.log('  Title:', articleData.title);
      console.log('  Author ID:', articleData.author);
      console.log('  Author Wallet:', articleData.authorWalletAddress);
    });
    
  } catch (error) {
    console.error('Error checking author status:', error);
  } finally {
    process.exit(0);
  }
}

checkAuthorStatus();
