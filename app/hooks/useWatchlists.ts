import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';
import { toast } from 'react-toastify';


export type Watchlist = {
  id: string;
  name: string;
  tokens: string[];
  createdAt: Date;
};

export const useWatchlists = () => {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen to watchlists changes
  useEffect(() => {
    if (!user) {
      setWatchlists([]);
      return;
    }

    const watchlistsRef = collection(db, `users/${user.uid}/watchlists`);
    const unsubscribe = onSnapshot(watchlistsRef, (snapshot) => {
      const wls = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        tokens: doc.data().tokens || [],
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Watchlist[];
      setWatchlists(wls);
    }, (error) => {
      console.error('Error listening to watchlists:', error);
    });

    return unsubscribe;
  }, [user]);

  const createWatchlist = useCallback(async (name: string) => {
    // If user is not authenticated, redirect to login
    if (!user) {
      toast.error('Please sign in to create watchlists', { position: 'bottom-left' });
      // Store current page for redirect after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return null;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, `users/${user.uid}/watchlists`), {
        name,
        tokens: [],
        createdAt: serverTimestamp(),
      });
      
      toast.success(`Watchlist "${name}" created successfully`, { position: 'bottom-left' });
      return docRef.id;
    } catch (err) {
      console.error('Error creating watchlist:', err);
      toast.error('Error creating watchlist', { position: 'bottom-left' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addToWatchlist = useCallback(async (watchlistId: string, poolAddress: string) => {
    // If user is not authenticated, redirect to login
    if (!user) {
      toast.error('Please sign in to manage watchlists', { position: 'bottom-left' });
      // Store current page for redirect after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const watchlistDocRef = doc(db, `users/${user.uid}/watchlists`, watchlistId);
      await updateDoc(watchlistDocRef, {
        tokens: arrayUnion(poolAddress),
      });
      
      const watchlist = watchlists.find(w => w.id === watchlistId);
      toast.success(`Added to ${watchlist?.name || 'watchlist'}`, { position: 'bottom-left' });
    } catch (err) {
      console.error('Error adding to watchlist:', err);
      toast.error('Error updating watchlist', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user, watchlists]);

  const removeFromWatchlist = useCallback(async (watchlistId: string, poolAddress: string) => {
    // If user is not authenticated, redirect to login
    if (!user) {
      toast.error('Please sign in to manage watchlists', { position: 'bottom-left' });
      // Store current page for redirect after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const watchlistDocRef = doc(db, `users/${user.uid}/watchlists`, watchlistId);
      await updateDoc(watchlistDocRef, {
        tokens: arrayRemove(poolAddress),
      });
      
      const watchlist = watchlists.find(w => w.id === watchlistId);
      toast.success(`Removed from ${watchlist?.name || 'watchlist'}`, { position: 'bottom-left' });
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      toast.error('Error updating watchlist', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user, watchlists]);

  const deleteWatchlist = useCallback(async (watchlistId: string) => {
    // If user is not authenticated, redirect to login
    if (!user) {
      toast.error('Please sign in to manage watchlists', { position: 'bottom-left' });
      // Store current page for redirect after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPath', window.location.pathname);
      }
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const watchlistDocRef = doc(db, `users/${user.uid}/watchlists`, watchlistId);
      await deleteDoc(watchlistDocRef);
      
      toast.success('Watchlist deleted successfully', { position: 'bottom-left' });
    } catch (err) {
      console.error('Error deleting watchlist:', err);
      toast.error('Error deleting watchlist', { position: 'bottom-left' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const isInWatchlist = useCallback((watchlistId: string, poolAddress: string) => {
    const watchlist = watchlists.find(w => w.id === watchlistId);
    return watchlist?.tokens.includes(poolAddress) || false;
  }, [watchlists]);

  const getWatchlistsForToken = useCallback((poolAddress: string) => {
    return watchlists.filter(w => w.tokens.includes(poolAddress));
  }, [watchlists]);

  return {
    watchlists,
    loading,
    createWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    deleteWatchlist,
    isInWatchlist,
    getWatchlistsForToken,
  };
};
