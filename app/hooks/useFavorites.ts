import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';
import { toast } from 'react-toastify';


export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to favorites changes
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }

    const favoritesRef = collection(db, `users/${user.uid}/favorites`);
    const unsubscribe = onSnapshot(favoritesRef, (snapshot) => {
      const favs = snapshot.docs.map(doc => doc.id);
      setFavorites(favs);
    }, (error) => {
      console.error('Error listening to favorites:', error);
    });

    return unsubscribe;
  }, [user]);

  const toggleFavorite = useCallback(async (poolAddress: string) => {
    console.log("🔍 useFavorites toggleFavorite called with user:", user?.uid, "authenticated:", !!user);
    
    // If user is not authenticated, redirect to login
    if (!user) {
      toast.error('Please sign in to manage favorites', { position: 'bottom-left' });
      // Store current page for redirect after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    const isFavorited = favorites.includes(poolAddress);
    
    try {
      const favoriteDocRef = doc(db, `users/${user.uid}/favorites`, poolAddress);
      
      if (isFavorited) {
        await deleteDoc(favoriteDocRef);
        toast.success('Removed from favorites', { position: 'bottom-left' });
      } else {
        await setDoc(favoriteDocRef, {
          poolAddress,
          createdAt: serverTimestamp(),
        });
        toast.success('Added to favorites', { position: 'bottom-left' });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      toast.error('Error updating favorites', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user, favorites]);

  const isFavorite = useCallback((poolAddress: string) => {
    return favorites.includes(poolAddress);
  }, [favorites]);

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
  };
};
