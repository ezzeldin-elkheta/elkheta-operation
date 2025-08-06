import { useState, useEffect } from 'react';
import { Collection } from '../lib/bunny/types';
import { cache } from '../lib/cache';

export function useSelectedCollection() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  useEffect(() => {
    // Load selected collection from localStorage on mount
    const storedCollection = localStorage.getItem('selectedCollection');
    if (storedCollection) {
      try {
        const parsed = JSON.parse(storedCollection);
        setSelectedCollection(parsed);
        // Also update cache
        cache.set('selectedCollection', parsed);
      } catch (error) {
        console.error('Error parsing stored collection:', error);
      }
    }
  }, []);

  const updateSelectedCollection = (collection: Collection | null) => {
    setSelectedCollection(collection);
    if (collection) {
      localStorage.setItem('selectedCollection', JSON.stringify(collection));
      cache.set('selectedCollection', collection);
    } else {
      localStorage.removeItem('selectedCollection');
      cache.remove('selectedCollection');
    }
  };

  return { 
    selectedCollection, 
    setSelectedCollection: updateSelectedCollection,
    selectedCollectionId: selectedCollection?.id || selectedCollection?.guid || ''
  };
} 