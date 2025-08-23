'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon, 
  ClipboardIcon, 
  HandThumbUpIcon, 
  HandThumbDownIcon,
  EyeIcon,
  UserIcon,
  ClockIcon,
  PaperAirplaneIcon,
  HeartIcon,
  ShareIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftIcon,
  BookmarkIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  doc, 
  updateDoc, 
  arrayUnion, 
  increment,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { useAuth, useWalletSystem } from '@/app/providers';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import PointTransactionModal from '../../components/PointTransactionModal';
import AlphaBoost from '../../components/AlphaBoost';

interface ArticleProps {
  article: {
    id: string;
    title: string;
    content: string;
    author: string;
    authorAlias?: string;
    source: string;
    slug: string;
    thumbnailUrl: string;
    publishedAt: string;
    views?: number;
    upvotes?: number;
    downvotes?: number;
    updatedAt?: string;
    category?: string;
    comments?: string[];
  };
}

interface Comment {
  id: string;
  articleSlug: string;
  userId: string;
  userAddress?: string;
  walletAddress?: string;
  alias?: string;
  content: string;
  createdAt: string;
  likes: string[];
  dislikes: string[];
  replies: string[];
  parentCommentId?: string;
  annotation?: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  };
  points?: number;
  isPinned?: boolean;
  articleAuthorId?: string;
  lastUpdated?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface Annotation {
  startOffset: number;
  endOffset: number;
  selectedText: string;
  commentId?: string;
}

export default function ArticleDetail({ article }: ArticleProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
  
  // Debug wallet connection
  console.log('Debug - useAuth user:', user);
  console.log('Debug - useWalletSystem selfCustodialWallet:', selfCustodialWallet);
  console.log('Debug - walletAddress:', walletAddress);
  
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [errorComments, setErrorComments] = useState<string | null>(null);
  const [articleStats, setArticleStats] = useState({
    views: article.views || 0,
    upvotes: article.upvotes || 0,
    downvotes: article.downvotes || 0,
  });
  const [userLiked, setUserLiked] = useState(false);
  const [userDisliked, setUserDisliked] = useState(false);
  const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);
  const [userReactions, setUserReactions] = useState<{[key: string]: string}>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<Array<{
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    slug: string;
    thumbnailUrl?: string;
    publishedAt: unknown;
    views?: number;
    upvotes?: number;
    downvotes?: number;
    updatedAt?: string;
    category?: string;
    comments?: string[];
  }>>([]);

  // Section insights state
  const [showInsightBox, setShowInsightBox] = useState(false);
  const [insights, setInsights] = useState<Annotation[]>([]);
  const [insightComment, setInsightComment] = useState<string>('');
  const [isInsightMode, setIsInsightMode] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<{ start: number; end: number; text: string; commentId?: string } | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<{ comment: Comment; insight: Annotation } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const annotationBoxRef = useRef<HTMLDivElement>(null);
  
  // Point transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [pendingComment, setPendingComment] = useState<string>('');
  const [userPoints, setUserPoints] = useState<number>(0);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Fetch user points on component mount
  useEffect(() => {
    const fetchUserPoints = async () => {
      if (!walletAddress) return;
      
      try {
        console.log('Fetching user points for walletAddress:', walletAddress);
        const response = await fetch(`/api/user/stats?walletAddress=${walletAddress}`);
        console.log('User points response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('User points data:', data);
          setUserPoints(data.points || 0);
        } else {
          const errorData = await response.json();
          console.error('User points API Error:', errorData);
        }
      } catch (error) {
        console.error('Error fetching user points:', error);
        setUserPoints(0); // Set default value on error
      }
    };

    fetchUserPoints();
  }, [walletAddress]);

  // ─── Utility Functions ───
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const formatDate = (dateString: string | unknown): string => {
    try {
      const date = new Date(String(dateString));
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Just now';
      }
      
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 48) return 'Yesterday';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'Just now';
    }
  };

  // Calculate reading time based on content length
  const calculateReadingTime = (content: string): number => {
    const wordsPerMinute = 200;
    const wordCount = content.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  // ─── Enhanced Text Selection Handler ───
  const handleDoubleClick = () => {
    if (isInsightMode) {
      // Exit insight mode
      setIsInsightMode(false);
      setShowInsightBox(false);
      setCurrentSelection(null);
      setInsightComment('');
      removeHighlights();
      window.getSelection()?.removeAllRanges();
      addToast('Insight mode deactivated.', 'info');
    } else {
      // Enter insight mode
      setIsInsightMode(true);
      addToast('Insight mode activated! Select text to add insights. Double-click again to exit.', 'info');
    }
  };

  const handleTextSelection = () => {
    if (!isInsightMode) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) {
      setShowInsightBox(false);
      setCurrentSelection(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 3) return; // Minimum 3 characters

    const range = selection.getRangeAt(0);
    
    setCurrentSelection({
      start: range.startOffset,
      end: range.endOffset,
      text: selectedText
    });
    setShowInsightBox(true);
  };

  // ─── Highlight Selected Text ───
  const highlightSelectedText = () => {
    if (!currentSelection || !contentRef.current) return;

    // First, remove any existing highlights to prevent duplicates
    const existingHighlights = contentRef.current.querySelectorAll('.bg-blue-400\\/30');
    existingHighlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        // Replace highlight with just the text content (excluding the profile icon)
        const textNodes = highlight.childNodes;
        const textContent = Array.from(textNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent)
          .join('');
        parent.replaceChild(document.createTextNode(textContent), highlight);
        parent.normalize();
      }
    });

    const content = contentRef.current;
    const textNodes = [];
    
    // Get all text nodes
    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Find the text node containing our selection
    let currentOffset = 0;
    let targetNode = null;
    let nodeStartOffset = 0;

    for (const textNode of textNodes) {
      const nodeLength = textNode.textContent?.length || 0;
      if (currentOffset <= currentSelection.start && 
          currentOffset + nodeLength >= currentSelection.end) {
        targetNode = textNode;
        nodeStartOffset = currentOffset;
        break;
      }
      currentOffset += nodeLength;
    }

    if (targetNode && targetNode.parentNode) {
      // Create highlight span
      const range = document.createRange();
      const startOffset = currentSelection.start - nodeStartOffset;
      const endOffset = currentSelection.end - nodeStartOffset;
      
      range.setStart(targetNode, startOffset);
      range.setEnd(targetNode, endOffset);

      try {
        // Extract the selected text
        const selectedText = range.toString();
        
        // Create highlight element
        const highlight = document.createElement('span');
        highlight.className = 'bg-blue-400/30 border-b-2 border-blue-400/50 animate-pulse';
        highlight.style.animationDuration = '1s';
        highlight.style.display = 'inline';
        highlight.style.whiteSpace = 'normal';
        highlight.style.lineHeight = 'inherit';
        highlight.style.margin = '0';
        highlight.style.padding = '0';
        
        // Create a text node for the selected text
        const textNode = document.createTextNode(selectedText);
        
        // Create profile icon
        const profileIcon = document.createElement('span');
        profileIcon.className = 'inline-block w-4 h-4 ml-1 cursor-pointer';
        profileIcon.style.display = 'inline';
        profileIcon.style.verticalAlign = 'middle';
        profileIcon.style.margin = '0';
        profileIcon.style.padding = '0';
        profileIcon.innerHTML = `
          <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        `;
        
        // Store the commentId for this highlight
        const commentId = currentSelection.commentId;
        
        // Add click handler to show insight popup
        profileIcon.addEventListener('click', () => {
          // Find the comment for this insight
          const insightComment = comments.find(c => c.id === commentId);
          if (insightComment) {
            // Set the selected insight to show in popup
            setSelectedInsight({
              comment: insightComment,
              insight: {
                startOffset: currentSelection.start,
                endOffset: currentSelection.end,
                selectedText: currentSelection.text,
                commentId: commentId
              }
            });
          }
        });
        
        // Replace the selected text with highlight + profile icon
        range.deleteContents();
        
        // Add the highlighted text and profile icon
        highlight.appendChild(textNode);
        highlight.appendChild(profileIcon);
        range.insertNode(highlight);
        
      } catch (error) {
        console.log('Could not highlight selection:', error);
      }
    }
  };

  // ─── Remove Highlights ───
  const removeHighlights = () => {
    const highlights = document.querySelectorAll('.bg-blue-400\\/30');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
  };

  // ─── Recreate Profile Icons for Existing Insights ───
  const recreateProfileIcons = (insightsList: Annotation[]) => {
    console.log('Recreating profile icons for insights:', insightsList);
    
    insightsList.forEach((insight) => {
      // Create a temporary currentSelection for this insight
      const tempSelection = {
        start: insight.startOffset,
        end: insight.endOffset,
        text: insight.selectedText,
        commentId: insight.commentId
      };
      
      // Temporarily set currentSelection and create profile icon
      const originalSelection = currentSelection;
      setCurrentSelection(tempSelection);
      
      setTimeout(() => {
        createPermanentProfileIcon(insight.commentId);
        setCurrentSelection(originalSelection);
      }, 100);
    });
  };

  // ─── Create Permanent Profile Icon (Remove Yellow Highlight) ───
  const createPermanentProfileIcon = (commentId?: string) => {
    if (!currentSelection || !contentRef.current) return;

    // First, remove any existing blue highlights
    const existingHighlights = contentRef.current.querySelectorAll('.bg-blue-400\\/30');
    existingHighlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        // Replace highlight with just the text content (excluding any profile icons)
        const textNodes = highlight.childNodes;
        const textContent = Array.from(textNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent)
          .join('')
          .trim(); // Remove any extra whitespace
        parent.replaceChild(document.createTextNode(textContent), highlight);
        parent.normalize();
      }
    });

    const content = contentRef.current;
    const textNodes = [];
    
    // Get all text nodes
    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    // Find the text node containing our selection
    let currentOffset = 0;
    let targetNode = null;
    let nodeStartOffset = 0;

    for (const textNode of textNodes) {
      const nodeLength = textNode.textContent?.length || 0;
      if (currentOffset <= currentSelection.start && 
          currentOffset + nodeLength >= currentSelection.end) {
        targetNode = textNode;
        nodeStartOffset = currentOffset;
        break;
      }
      currentOffset += nodeLength;
    }

    if (targetNode && targetNode.parentNode) {
      // Create range for the selected text
      const range = document.createRange();
      const startOffset = currentSelection.start - nodeStartOffset;
      const endOffset = currentSelection.end - nodeStartOffset;
      
      range.setStart(targetNode, startOffset);
      range.setEnd(targetNode, endOffset);

      try {
        // Create profile icon (empty circle for profile picture)
        const profileIcon = document.createElement('span');
        profileIcon.className = 'inline-block w-3 h-3 cursor-pointer rounded-full';
        profileIcon.style.display = 'inline-block';
        profileIcon.style.verticalAlign = 'baseline';
        profileIcon.style.margin = '0 0 0 4px';
        profileIcon.style.padding = '0';
        profileIcon.style.lineHeight = '1';
        profileIcon.style.whiteSpace = 'nowrap';
        profileIcon.style.width = '18px';
        profileIcon.style.height = '18px';
        profileIcon.style.borderRadius = '50%';
        profileIcon.style.backgroundColor = 'rgba(156, 163, 175, 0.2)';
        profileIcon.style.border = '1px solid rgba(107, 114, 128, 0.6)';
        profileIcon.style.cursor = 'pointer';
        profileIcon.style.pointerEvents = 'auto';
        profileIcon.title = 'Click to view insight';
        // Empty circle - no inner content
        
        // Use the passed commentId or fall back to currentSelection
        const finalCommentId = commentId || currentSelection.commentId;
        console.log('Creating profile icon with commentId:', finalCommentId);
        
        // Add click handler to show insight popup
        profileIcon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Profile icon clicked! CommentId:', finalCommentId);
          
          // Find the comment for this insight
          const insightComment = comments.find(c => c.id === finalCommentId);
          console.log('Found insight comment:', insightComment);
          
          if (insightComment) {
            // Set the selected insight to show in popup
            setSelectedInsight({
              comment: insightComment,
              insight: {
                startOffset: currentSelection.start,
                endOffset: currentSelection.end,
                selectedText: currentSelection.text,
                commentId: finalCommentId
              }
            });
            console.log('Selected insight set:', insightComment);
          } else {
            console.log('No insight comment found for commentId:', finalCommentId);
          }
        });
        
        // Insert profile icon right after the selected text (don't split text)
        range.collapse(false); // Collapse to end of selection
        range.insertNode(profileIcon);
        
      } catch (error) {
        console.log('Could not create permanent profile icon:', error);
      }
    }
  };

  // ─── Create Section Insight ───
  const createInsight = async () => {
    console.log('Debug - user:', user);
    console.log('Debug - walletAddress:', walletAddress);
    console.log('Debug - selfCustodialWallet:', selfCustodialWallet);
    console.log('Debug - insightComment:', insightComment);
    
    if (!user) {
      addToast('Please sign in to create insights', 'error');
      return;
    }
    
    // For now, use user ID as wallet address since we don't have real blockchain integration
    const finalWalletAddress = walletAddress || selfCustodialWallet?.address || `user_${user.uid}`;
    
    if (!insightComment.trim()) {
      addToast('Please provide a comment for your insight', 'error');
      return;
    }

    if (!currentSelection) {
      addToast('No text selected for insight', 'error');
      return;
    }

    try {
      // Create comment with annotation
      const response = await fetch(`/api/articles/${article.slug}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          walletAddress: finalWalletAddress,
          content: insightComment.trim(),
          annotation: {
            startOffset: currentSelection.start,
            endOffset: currentSelection.end,
            selectedText: currentSelection.text,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add insight to local state
        const newInsight: Annotation = {
          startOffset: currentSelection.start,
          endOffset: currentSelection.end,
          selectedText: currentSelection.text,
          commentId: data.comment.id,
        };
        setInsights(prev => [...prev, newInsight]);

        // Add comment to comments list
        setComments(prev => [data.comment, ...prev]);

        // Update currentSelection with commentId for the profile icon
        if (currentSelection) {
          console.log('Setting commentId for profile icon:', data.comment.id);
          setCurrentSelection({
            ...currentSelection,
            commentId: data.comment.id
          });
        }

        addToast(`Insight created! +${data.pointsEarned} points`, 'success');
        setInsightComment('');
        setShowInsightBox(false);
        setIsInsightMode(false);
        window.getSelection()?.removeAllRanges();
        
        // Remove yellow highlight but keep profile icon
        setTimeout(() => {
          createPermanentProfileIcon(data.comment.id);
        }, 100);
      } else {
        const errorData = await response.json();
        addToast(errorData.error || 'Failed to create annotation', 'error');
      }
    } catch (error) {
      console.error('Error creating annotation:', error);
      addToast('Error creating annotation', 'error');
    }
  };

  // ─── Cancel Insight ───
  const cancelInsight = () => {
    setShowInsightBox(false);
    setInsightComment('');
    setCurrentSelection(null);
    setIsInsightMode(false);
    removeHighlights();
    window.getSelection()?.removeAllRanges();
  };

  // ─── Handle Click Outside ───
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (annotationBoxRef.current && !annotationBoxRef.current.contains(event.target as Node)) {
        if (showInsightBox) {
          cancelInsight();
        }
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showInsightBox) {
          cancelInsight();
        }
        if (selectedInsight) {
          setSelectedInsight(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showInsightBox, selectedInsight]);

  // ─── Highlight Selected Text When Insight Box Appears ───
  useEffect(() => {
    if (showInsightBox && currentSelection) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        highlightSelectedText();
      }, 100);
    }
  }, [showInsightBox, currentSelection]);

  // ─── Increment views on mount ───
  useEffect(() => {
    async function incrementViews() {
      try {
        const articleRef = doc(db, 'articles', article.id);
        await updateDoc(articleRef, { 
          views: increment(1), 
          updatedAt: new Date().toISOString() 
        });
        setArticleStats(prev => ({ ...prev, views: prev.views + 1 }));


      } catch (error) {
        console.error('Error incrementing views:', error);
      }
    }
    
    if (article.id) {
      incrementViews();
    }
  }, [article.id, user, walletAddress, article.slug]);

  // ─── Fetch comments and insights ───
  useEffect(() => {
    async function fetchComments() {
      try {
        const response = await fetch(`/api/articles/${article.slug}/comments`);
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched comments data:', data);
          setComments(data.comments || []);
          
          // Extract insights from comments with annotations
          const insightsFromComments = data.comments
            .filter((comment: Comment) => comment.annotation)
            .map((comment: Comment) => ({
              startOffset: comment.annotation!.startOffset,
              endOffset: comment.annotation!.endOffset,
              selectedText: comment.annotation!.selectedText,
              commentId: comment.id,
            }));
          
          setInsights(insightsFromComments);
          console.log('Loaded insights from comments:', insightsFromComments);
          
          // Recreate profile icons for existing insights
          setTimeout(() => {
            recreateProfileIcons(insightsFromComments);
          }, 500);
          
        } else {
          // Fallback to old method
          const q = query(
            collection(db, 'comments'), 
            where('articleSlug', '==', article.slug),
            orderBy('createdAt', 'desc')
          );
          const snap = await getDocs(q);
          const data = snap.docs.map((doc) => ({ 
            id: doc.id, 
            ...doc.data() 
          } as Comment));
          setComments(data);
          
          // Extract insights from comments with annotations
          const insightsFromComments = data
            .filter((comment: Comment) => comment.annotation)
            .map((comment: Comment) => ({
              startOffset: comment.annotation!.startOffset,
              endOffset: comment.annotation!.endOffset,
              selectedText: comment.annotation!.selectedText,
              commentId: comment.id,
            }));
          
          setInsights(insightsFromComments);
          console.log('Loaded insights from comments (fallback):', insightsFromComments);
          
          // Recreate profile icons for existing insights
          setTimeout(() => {
            recreateProfileIcons(insightsFromComments);
          }, 500);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
        setErrorComments('Failed to load comments');
      } finally {
        setLoadingComments(false);
      }
    }
    fetchComments();
  }, [article.slug]);

  // ─── Fetch related articles ───
  useEffect(() => {
    async function fetchRelatedArticles() {
      try {
        const q = query(
          collection(db, 'articles'),
          where('category', '==', article.category),
          orderBy('publishedAt', 'desc'),
          limit(3)
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as {
            id: string;
            title: string;
            content: string;
            author: string;
            source: string;
            slug: string;
            thumbnailUrl?: string;
            publishedAt: unknown;
            views?: number;
            upvotes?: number;
            downvotes?: number;
            updatedAt?: string;
            category?: string;
            comments?: string[];
          }))
          .filter(item => item.slug !== article.slug)
          .slice(0, 3);
        setRelatedArticles(data);
      } catch (error) {
        console.error('Error fetching related articles:', error);
      }
    }
    
    if (article.category) {
      fetchRelatedArticles();
    }
  }, [article.category, article.slug]);

  // ─── Check user's previous interactions ───
  useEffect(() => {
    async function checkUserInteractions() {
          if (!user) return;
    
    // For now, use user ID as wallet address since we don't have real blockchain integration
    const finalWalletAddress = walletAddress || selfCustodialWallet?.address || `user_${user.uid}`;
    
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('walletAddress', '==', finalWalletAddress)));
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          const likedArticles = userData.likedArticles || [];
          const dislikedArticles = userData.dislikedArticles || [];
          const bookmarkedArticles = userData.bookmarkedArticles || [];
          const reactions = userData.reactions || {};
          
          setUserLiked(likedArticles.includes(article.slug));
          setUserDisliked(dislikedArticles.includes(article.slug));
          setBookmarkedArticles(bookmarkedArticles);
          setUserReactions(reactions);
        }
      } catch (error) {
        console.error('Error checking user interactions:', error);
      }
    }
    
    checkUserInteractions();
  }, [user, walletAddress, article.slug]);

  // ─── Event Handlers ───
  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      addToast('Please sign in to comment.', 'error');
      return;
    }
    
    if (!newComment.trim()) {
      addToast('Comment cannot be empty.', 'error');
      return;
    }

    if (isSubmittingComment) {
      addToast('Please wait, comment is being processed...', 'info');
      return;
    }

    // Clear the form input immediately to prevent double submission
    const commentText = newComment.trim();
    setNewComment('');
    
    // Set pending comment and show transaction modal
    setPendingComment(commentText);
    setShowTransactionModal(true);
  };

  // Handle comment interactions (like, dislike, pin)
  const handleCommentInteraction = async (commentId: string, action: 'like' | 'dislike' | 'pin') => {
    if (!user) {
      addToast('Please sign in to interact with comments.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          action,
          articleAuthorId: article.author
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.comment) {
          // Update the comment in the local state
          setComments(prev => prev.map(comment => 
            comment.id === commentId ? data.comment : comment
          ));
          
          // Show appropriate toast message
          switch (action) {
            case 'like':
              addToast(data.comment.likes.includes(user.uid) ? 'Comment liked!' : 'Like removed', 'success');
              break;
            case 'dislike':
              addToast(data.comment.dislikes.includes(user.uid) ? 'Comment disliked!' : 'Dislike removed', 'success');
              break;
            case 'pin':
              addToast(data.comment.isPinned ? 'Comment pinned!' : 'Comment unpinned!', 'success');
              break;
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        addToast(errorData.error || 'Failed to process interaction', 'error');
      }
    } catch (error) {
      console.error('Error handling comment interaction:', error);
      addToast('Failed to process interaction', 'error');
    }
  };

  const handleConfirmCommentTransaction = async () => {
    if (!pendingComment.trim() || isSubmittingComment) {
      console.log('Preventing duplicate comment submission:', { 
        hasPendingComment: !!pendingComment.trim(), 
        isSubmitting: isSubmittingComment 
      });
      return;
    }

    console.log('Starting comment transaction for:', pendingComment.trim());
    setIsSubmittingComment(true);
    try {
      console.log('Starting comment transaction...');
      
      // Ensure we have a consistent wallet address
      const finalWalletAddress = walletAddress || selfCustodialWallet?.address || `user_${user?.uid}`;
      
      // First, deduct points from commenter
      const spendResponse = await fetch('/api/points/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || '',
          walletAddress: finalWalletAddress,
          action: 'post_comment',
          metadata: {
            articleSlug: article.slug,
            commentLength: pendingComment.length
          }
        })
      });

      if (!spendResponse.ok) {
        const errorData = await spendResponse.json().catch(() => ({}));
        throw new Error(`Failed to spend points: ${errorData.error || spendResponse.statusText}`);
      }

      // Then, award points to the author (only if author exists as a user)
      try {
        const earnResponse = await fetch('/api/points/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: article.author || `author_${article.id}`,
            walletAddress: article.author || `author_${article.id}`,
            action: 'receive_comment',
            metadata: {
              articleSlug: article.slug,
              commentLength: pendingComment.length,
              commenterWallet: finalWalletAddress
            }
          })
        });

        if (!earnResponse.ok) {
          console.warn('Failed to award points to author, but comment was posted');
        }
      } catch (error) {
        console.warn('Error awarding points to author:', error);
        // Don't let this error crash the comment posting
      }

      // Now post the comment
      const commentResponse = await fetch(`/api/articles/${article.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || '',
          walletAddress: finalWalletAddress,
          content: pendingComment.trim()
        })
      });

      if (commentResponse.ok) {
        const response = await commentResponse.json();
        console.log('Comment creation response:', response);
        if (response.success && response.comment) {
          const newComment = response.comment; // Extract the comment from the response
          setComments(prev => {
            // Check if this comment already exists to prevent duplicates
            const commentExists = prev.some(comment => 
              comment.id === newComment.id || 
              (comment.content === newComment.content && 
               comment.userId === newComment.userId &&
               Math.abs(new Date(comment.createdAt).getTime() - new Date(newComment.createdAt).getTime()) < 5000) // Within 5 seconds
            );
            
            if (commentExists) {
              console.log('Comment already exists, not adding duplicate');
              return prev;
            }
            
            console.log('Adding new comment to state:', newComment);
            return [newComment, ...prev];
          });
          setInsightComment('');
          setPendingComment('');
          setShowTransactionModal(false);
          addToast('Comment Posted!', 'success');
        } else {
          throw new Error('Invalid comment response');
        }
        
        // Refresh user points
        try {
          const pointsResponse = await fetch(`/api/user/stats?walletAddress=${user?.uid}`);
          if (pointsResponse.ok) {
            const data = await pointsResponse.json();
            setUserPoints(data.points || 0);
          }
        } catch (error) {
          console.warn('Failed to refresh user points:', error);
        }
      } else {
        const errorData = await commentResponse.json().catch(() => ({}));
        throw new Error(`Failed to post comment: ${errorData.error || commentResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      addToast('Failed to post comment. Please try again.', 'error');
      
      // Reset any state that might be in an inconsistent state
      setPendingComment('');
      setShowTransactionModal(false);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleArticleVote = async (isUpvote: boolean) => {
    if (!user) {
      addToast('Please sign in to vote.', 'error');
      return;
    }
    
    // For now, use user ID as wallet address since we don't have real blockchain integration
    const finalWalletAddress = walletAddress || selfCustodialWallet?.address || `user_${user.uid}`;

    try {
      const articleRef = doc(db, 'articles', article.id);
      const userRef = doc(db, 'users', user.uid);

      if (isUpvote) {
        if (userLiked) {
          // Unlike
          await updateDoc(articleRef, { upvotes: increment(-1) });
          setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes - 1 }));
          setUserLiked(false);
        } else {
          // Like
          await updateDoc(articleRef, { upvotes: increment(1) });
          setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes + 1 }));
          setUserLiked(true);
          
          // Remove dislike if exists
          if (userDisliked) {
            await updateDoc(articleRef, { downvotes: increment(-1) });
            setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes - 1 }));
            setUserDisliked(false);
          }

          // Track activity
          await addDoc(collection(db, 'user_activities'), {
            userId: user.uid,
            walletAddress: finalWalletAddress,
            action: 'like_article',
            points: 5,
            articleSlug: article.slug,
            createdAt: serverTimestamp()
          });

          // Update user points
          await updateDoc(userRef, {
            points: increment(5),
            likedArticles: arrayUnion(article.slug)
          });

          addToast('Article liked! +5 points', 'success');
        }
      } else {
        if (userDisliked) {
          // Remove dislike
          await updateDoc(articleRef, { downvotes: increment(-1) });
          setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes - 1 }));
          setUserDisliked(false);
        } else {
          // Dislike
          await updateDoc(articleRef, { downvotes: increment(1) });
          setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes + 1 }));
          setUserDisliked(true);
          
          // Remove like if exists
          if (userLiked) {
            await updateDoc(articleRef, { upvotes: increment(-1) });
            setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes - 1 }));
            setUserLiked(false);
          }

          // Update user disliked articles
          await updateDoc(userRef, {
            dislikedArticles: arrayUnion(article.slug)
          });
        }
      }
    } catch (error: unknown) {
      console.error('Error toggling vote:', error);
      addToast('Failed to update vote.', 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/insights/${article.slug}`);
      addToast('Link copied to clipboard!', 'success');
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  const shareToX = () => {
    const url = `${window.location.origin}/insights/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    
    if (user && walletAddress) {
      // Track sharing activity
      addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'share_x',
        points: 10,
        articleSlug: article.slug,
        createdAt: serverTimestamp()
      }).then(() => {
        // Update user points
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { points: increment(10) });
        addToast('Shared to X! +10 points', 'success');
      }).catch(error => {
        console.error('Error tracking share:', error);
      });
    }
  };

  const shareToTelegram = () => {
    const url = `${window.location.origin}/insights/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    
    if (user && walletAddress) {
      // Track sharing activity
      addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'share_telegram',
        points: 10,
        articleSlug: article.slug,
        createdAt: serverTimestamp()
      }).then(() => {
        // Update user points
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { points: increment(10) });
        addToast('Shared to Telegram! +10 points', 'success');
      }).catch(error => {
        console.error('Error tracking share:', error);
      });
    }
  };

  const toggleBookmark = async () => {
    if (!user || !walletAddress) {
      addToast('Please create or connect your wallet to bookmark articles', 'error');
      return;
    }

    try {
      const isBookmarked = bookmarkedArticles.includes(article.slug);
      
      if (isBookmarked) {
        setBookmarkedArticles(prev => prev.filter(slug => slug !== article.slug));
        addToast('Article removed from bookmarks', 'info');
      } else {
        setBookmarkedArticles(prev => [...prev, article.slug]);
        addToast('Article bookmarked!', 'success');
      }
      
      // Here you would typically save to backend
      // For now, we'll just update local state
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      addToast('Error bookmarking article', 'error');
    }
  };

  const handleReaction = async (reactionType: string) => {
    if (!user || !walletAddress) {
      addToast('Please create or connect your wallet to react to articles', 'error');
      return;
    }

    try {
      const currentReaction = userReactions[article.slug];
      
      if (currentReaction === reactionType) {
        // Remove reaction
        setUserReactions(prev => {
          const newReactions = { ...prev };
          delete newReactions[article.slug];
          return newReactions;
        });
        addToast('Reaction removed', 'info');
      } else {
        // Check if user has already used their daily reaction on this article
        const hasReactedToday = Object.keys(userReactions).some(key => 
          key.startsWith(article.slug) && userReactions[key] === reactionType
        );
        
        if (hasReactedToday) {
          addToast('You can only use one reaction per article per day', 'info');
          return;
        }
        
        // Add/change reaction
        setUserReactions(prev => ({
          ...prev,
          [article.slug]: reactionType
        }));
        addToast(`Marked as ${reactionType}!`, 'success');
      }
      
      // Here you would typically save to backend
      // For now, we'll just update local state
    } catch (error) {
      console.error('Error handling reaction:', error);
      addToast('Error reacting to article', 'error');
    }
  };

  const handleThumbnailError = () => {
    setFailedThumbnail('https://via.placeholder.com/800x400/1f2937/ffffff?text=Article+Image');
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      
      {/* Separator Line */}
      <div className="border-b border-gray-800"></div>
      
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-2xl max-w-sm backdrop-blur-sm border ${
              toast.type === 'success' ? 'bg-green-500/90 text-white border-green-400/30' :
              toast.type === 'error' ? 'bg-red-500/90 text-white border-red-400/30' :
              'bg-blue-500/90 text-white border-blue-400/30'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>



      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero Section with Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.push('/insights')}
            className="group flex items-center gap-3 text-blue-400 hover:text-blue-300 transition-all duration-300 hover:scale-105"
          >
            <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </div>
            <span className="font-semibold text-xl">Insights</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Article Content */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl overflow-hidden border border-gray-700/50 backdrop-blur-sm shadow-2xl"
            >
              {/* Article Header with Enhanced Design */}
              <div className="p-8 bg-gradient-to-r from-gray-800/30 to-gray-700/30">
                <div className="flex items-center gap-3 mb-6">
                  {article.category && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 text-sm rounded-full border border-blue-500/30 font-medium"
                    >
                      {article.category}
                    </motion.span>
                  )}
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-gray-400 text-sm flex items-center gap-2"
                  >
                    <ClockIcon className="w-4 h-4" />
                    {formatDate(article.publishedAt)}
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-gray-400 text-sm flex items-center gap-2"
                  >
                    <ClockIcon className="w-4 h-4" />
                    {calculateReadingTime(article.content)} min read
                  </motion.span>
                </div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight"
                >
                  {article.title}
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-6 text-gray-300"
                >
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <UserIcon className="w-5 h-5 text-blue-400" />
                    <span className="font-medium">{article.authorAlias || article.author}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <EyeIcon className="w-5 h-5 text-green-400" />
                    <span className="font-medium">{articleStats.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-blue-400" />
                    <span className="font-medium">{article.source}</span>
                  </div>
                  <AlphaBoost 
                    articleId={article.id} 
                    articleSlug={article.slug}
                    className="ml-auto"
                  />
                </motion.div>
              </div>

              {/* Enhanced Article Image */}
              {article.thumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="relative h-80 sm:h-96 lg:h-[500px] overflow-hidden"
                >
                  <Image
                    src={failedThumbnail || article.thumbnailUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    onError={handleThumbnailError}
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-4 text-white">
                      <div className="flex items-center gap-2">
                        <HeartIcon className="w-5 h-5 text-red-400" />
                        <span className="font-bold">{articleStats.upvotes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HandThumbDownIcon className="w-5 h-5 text-blue-400" />
                        <span className="font-bold">{articleStats.downvotes}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Enhanced Article Content */}
              <div className="p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="prose prose-invert max-w-none"
                >
                  {/* Insight Mode Indicator */}
                  {isInsightMode && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <p className="text-blue-300 font-medium">
                          Insight Mode Active - Double-click to activate, then select text to add insights
                        </p>
                        <button
                          onClick={() => setIsInsightMode(false)}
                          className="ml-auto px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
                        >
                          Exit Mode
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div 
                    ref={contentRef}
                    className={`text-gray-300 leading-relaxed whitespace-pre-wrap text-base sm:text-lg font-light select-text transition-all duration-300 ${
                      isInsightMode ? 'cursor-crosshair' : 'cursor-text'
                    }`}
                    onMouseUp={handleTextSelection}
                    onDoubleClick={handleDoubleClick}
                    style={{ position: 'relative' }}
                  >
                    {article.content}
                  </div>
                </motion.div>

                {/* Enhanced Article Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-12 pt-8 border-t border-gray-700/50"
                >
                  <div className="flex items-center gap-4">
                    {/* Bookmark Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleBookmark}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                        bookmarkedArticles.includes(article.slug)
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/30'
                      }`}
                    >
                      <BookmarkIcon className={`w-5 h-5 ${bookmarkedArticles.includes(article.slug) ? 'fill-current' : ''}`} />
                    </motion.button>

                    {/* Alpha Reaction */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReaction('alpha')}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                        userReactions[article.slug] === 'alpha'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/30'
                      }`}
                      title="Alpha"
                    >
                      <BoltIcon className="w-5 h-5" />
                      <span className="text-sm">Alpha</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleArticleVote(true)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                        userLiked
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/30'
                      }`}
                    >
                      <HeartIcon className={`w-5 h-5 ${userLiked ? 'fill-current' : ''}`} />
                      <span className="text-sm">{articleStats.upvotes || 0}</span>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleArticleVote(false)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 ${
                        userDisliked
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/30'
                      }`}
                    >
                      <HandThumbDownIcon className={`w-5 h-5 ${userDisliked ? 'fill-current' : ''}`} />
                      <span className="text-sm">{articleStats.downvotes || 0}</span>
                    </motion.button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyLink}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ClipboardIcon className="w-5 h-5" />
                      Copy Link
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={shareToX}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ShareIcon className="w-5 h-5" />
                      Share X
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={shareToTelegram}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-blue-600/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ShareIcon className="w-5 h-5" />
                      Share TG
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Enhanced Comments Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-8 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-2xl"
            >
              <div className="p-8">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xl font-bold text-white mb-6 flex items-center gap-3"
                >
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-400" />
                  Comments & Discussions
                </motion.h2>

                {/* Enhanced Comment Form */}
                {user && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-6 bg-gradient-to-r from-gray-700/30 to-gray-600/30 rounded-xl border border-gray-600/30"
                  >
                    <form onSubmit={handleSubmitComment} className="space-y-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share your thoughts on this article..."
                        className="w-full px-6 py-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-lg"
                        rows={4}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">
                          {newComment.length}/500 characters
                        </span>
                        <motion.button
                          whileHover={{ scale: isSubmittingComment ? 1 : 1.05 }}
                          whileTap={{ scale: isSubmittingComment ? 1 : 0.95 }}
                          type="submit"
                          disabled={isSubmittingComment || !newComment.trim()}
                          className={`flex items-center gap-3 px-8 py-3 rounded-xl transition-all duration-300 font-medium shadow-lg ${
                            isSubmittingComment || !newComment.trim()
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                          }`}
                        >
                          {isSubmittingComment ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Posting...
                            </>
                          ) : (
                            <>
                              <PaperAirplaneIcon className="w-5 h-5" />
                              Post Comment
                            </>
                          )}
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {!user && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20"
                  >
                    <p className="text-gray-300 text-center text-lg">
                      Connect your wallet to comment and earn points!
                    </p>
                  </motion.div>
                )}

                {/* Enhanced Comments List */}
                {loadingComments ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="text-gray-400 mt-4 text-lg">Loading comments...</p>
                  </div>
                ) : errorComments ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 text-lg">{errorComments}</p>
                  </div>
                ) : !comments || comments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No comments yet. Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {comments && comments
                      .filter(comment => comment.content && comment.content.trim() !== '')
                      .sort((a, b) => {
                        // Sort pinned comments first, then by creation date
                        if (a.isPinned && !b.isPinned) return -1;
                        if (!a.isPinned && b.isPinned) return 1;
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      })
                      .map((comment, index) => (
                      <motion.div
                        key={comment.id}
                        id={`comment-${comment.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-6 rounded-xl border transition-all duration-300 ${
                          comment.isPinned 
                            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50 hover:border-yellow-400/70' 
                            : 'bg-gradient-to-r from-gray-700/30 to-gray-600/30 border-gray-600/30 hover:border-gray-500/50'
                        }`}
                      >
                        {comment.isPinned && (
                          <div className="flex items-center gap-2 mb-3 text-yellow-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                            </svg>
                            <span className="text-sm font-medium">Pinned by Author</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                              <UserIcon className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-300">
                                {comment.alias || (comment.walletAddress ? 
                                  `${comment.walletAddress.slice(0, 6)}...${comment.walletAddress.slice(-4)}` : 
                                  comment.userAddress ? 
                                    `${comment.userAddress.slice(0, 6)}...${comment.userAddress.slice(-4)}` : 
                                    'Anonymous')
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(comment.createdAt)}
                                {comment.likes?.length > 0 && (
                                  <span className="ml-2 text-green-400">+{comment.likes.length * 2} pts from likes</span>
                                )}
                                {comment.isPinned && (
                                  <span className="ml-2 text-yellow-400">+25 pts pinned</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-200 mb-4 text-lg leading-relaxed">{comment.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={() => handleCommentInteraction(comment.id, 'like')}
                              className={`flex items-center gap-2 transition-colors ${
                                comment.likes?.includes(user?.uid || '') 
                                  ? 'text-blue-400' 
                                  : 'text-gray-400 hover:text-blue-400'
                              }`}
                            >
                              <HandThumbUpIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">{comment.likes?.length || 0}</span>
                            </button>
                            <button 
                              onClick={() => handleCommentInteraction(comment.id, 'dislike')}
                              className={`flex items-center gap-2 transition-colors ${
                                comment.dislikes?.includes(user?.uid || '') 
                                  ? 'text-red-400' 
                                  : 'text-gray-400 hover:text-red-400'
                              }`}
                            >
                              <HandThumbDownIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">{comment.dislikes?.length || 0}</span>
                            </button>
                            <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors">
                              <ChatBubbleOvalLeftIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">{comment.replies?.length || 0}</span>
                            </button>
                          </div>
                          
                          {/* Pin button for article author */}
                          {user && article.author === user.uid && (
                            <button 
                              onClick={() => handleCommentInteraction(comment.id, 'pin')}
                              className={`flex items-center gap-2 transition-colors ${
                                comment.isPinned 
                                  ? 'text-yellow-400' 
                                  : 'text-gray-400 hover:text-yellow-400'
                              }`}
                              title={comment.isPinned ? 'Unpin comment' : 'Pin comment'}
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Enhanced Related Articles */}
              {relatedArticles && relatedArticles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-2xl"
                >
                  <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                    📚 Related Articles
                  </h3>
                  <div className="space-y-4">
                    {relatedArticles && relatedArticles.map((relatedArticle, index) => (
                      <motion.div
                        key={relatedArticle.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + index * 0.1 }}
                        className="cursor-pointer group p-4 bg-gray-700/20 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300"
                        onClick={() => router.push(`/insights/${relatedArticle.slug}`)}
                      >
                        <h4 className="text-sm font-medium text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                          {relatedArticle.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {formatDate(relatedArticle.publishedAt)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Enhanced Article Stats */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-2xl"
              >
                <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                  📊 Article Stats
                </h3>
                                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-300">
                        <EyeIcon className="w-4 h-4" />
                        <span>Views</span>
                      </div>
                      <span className="text-white font-bold text-lg">{(articleStats.views || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-300">
                        <HandThumbUpIcon className="w-4 h-4" />
                        <span>Upvotes</span>
                      </div>
                      <span className="text-green-400 font-bold text-lg">{articleStats.upvotes || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-300">
                        <HandThumbDownIcon className="w-4 h-4" />
                        <span>Downvotes</span>
                      </div>
                      <span className="text-red-400 font-bold text-lg">{articleStats.downvotes || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-300">
                        <ChatBubbleLeftRightIcon className="w-4 h-4" />
                        <span>Comments</span>
                      </div>
                      <span className="text-blue-400 font-bold text-lg">{comments.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-300">
                        <BoltIcon className="w-4 h-4" />
                        <span>Insights</span>
                      </div>
                      <span className="text-purple-400 font-bold text-lg">{insights.length}</span>
                    </div>
                  </div>
              </motion.div>

              {/* Insight Box */}
              <AnimatePresence>
                {showInsightBox && (
                  <motion.div
                    ref={annotationBoxRef}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <h3 className="text-sm font-semibold text-white">Add Insight</h3>
                      </div>
                      <button
                        onClick={cancelInsight}
                        className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="p-4">
                      {/* Selected Text Display */}
                      <div className="mb-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-xs text-blue-300 mb-1 font-medium">Selected:</p>
                        <p className="text-sm text-blue-200 italic leading-relaxed line-clamp-2">
                          &ldquo;{currentSelection?.text}&rdquo;
                        </p>
                      </div>

                      {/* Comment Input */}
                      <div className="mb-4">
                        <textarea
                          value={insightComment}
                          onChange={(e) => setInsightComment(e.target.value)}
                          placeholder="Share your insight..."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                          rows={3}
                          autoFocus
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={createInsight}
                          disabled={!insightComment.trim()}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Add Insight
                        </button>
                        <button
                          onClick={cancelInsight}
                          className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Help Text */}
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Earn +25 points for insights
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Annotation Popup */}
              <AnimatePresence>
                {selectedInsight && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl"
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-blue-400" />
                          </div>
                          <span className="text-sm font-medium text-white">
                            {selectedInsight.comment.userAddress ? 
                              `${selectedInsight.comment.userAddress.slice(0, 6)}...${selectedInsight.comment.userAddress.slice(-4)}` : 
                              'Anonymous'
                            }
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedInsight(null)}
                          className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Annotated Text */}
                      <div className="mb-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-xs text-blue-300 mb-1 font-medium">Annotated text:</p>
                        <p className="text-sm text-blue-200 italic leading-relaxed">
                          &ldquo;{selectedInsight.insight.selectedText}&rdquo;
                        </p>
                      </div>

                      {/* Insight Content */}
                      <div className="mb-3">
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {selectedInsight.comment.content}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(selectedInsight.comment.createdAt)}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <HandThumbUpIcon className="w-3 h-3" />
                            {selectedInsight.comment.likes.length}
                          </span>
                          <span className="flex items-center gap-1">
                            <HandThumbDownIcon className="w-3 h-3" />
                            {selectedInsight.comment.dislikes.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </main>

      {/* Point Transaction Modal */}
      <PointTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onConfirm={handleConfirmCommentTransaction}
        transaction={{
          action: 'post_comment',
          points: 5,
          description: 'Post comment on article',
          metadata: {
            articleSlug: article.slug,
            commentLength: pendingComment.length,
            authorName: article.author
          }
        }}
        userPoints={userPoints}
        walletAddress={walletAddress}
      />

      <Footer />
    </div>
  );
}
