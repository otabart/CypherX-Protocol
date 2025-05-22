import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Define the Ad interface for type safety
interface Ad {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  altText: string;
  type: 'banner' | 'sidebar' | 'inline';
  createdAt: string;
}

// Define response type for better clarity
interface ApiResponse {
  ads?: Ad[];
  error?: string;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    // Query Firestore for ads, ordered by creation date (descending)
    const adsCol = collection(db, 'adImageUrl');
    const q = query(adsCol, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    // Map Firestore documents to Ad array
    const ads: Ad[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      imageUrl: doc.data().imageUrl,
      destinationUrl: doc.data().destinationUrl,
      altText: doc.data().altText,
      type: doc.data().type as 'banner' | 'sidebar' | 'inline',
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));

    // Log ad IDs for debugging
    console.log('Ads fetched:', ads.map(ad => ad.id));

    // Return successful response
    return res.status(200).json({ ads });
  } catch (error: unknown) {
    // Log error and return error response
    console.error('Error fetching ads:', error);
    return res.status(500).json({ error: 'Failed to fetch ads' });
  }
}