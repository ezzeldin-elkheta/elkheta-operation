import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QueueItem } from '@/lib/upload/types'; // Import QueueItem type

interface ManualLibrarySelectorProps {
  isOpen: boolean;
  item: QueueItem | null; // Use QueueItem type
  libraries: Array<{ id: string; name: string; score?: number }>; // score is optional
  onClose: () => void;
  onSelect: (itemId: string, libraryId: string, libraryName: string) => void; // Add libraryName
}

const ManualLibrarySelector: React.FC<ManualLibrarySelectorProps> = ({
  isOpen,
  item,
  libraries, // This is the list of *all* available libraries passed from the parent
  onClose,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<string | null>(null);

  // Reset selected library when dialog opens with new item
  useEffect(() => {
    if (isOpen) {
      setSelectedLibrary(null);
      setSearchQuery('');
    }
  }, [isOpen, item?.id]);

  if (!item) return null;

  // Use suggestedLibraries from the item's metadata if available, otherwise use the full list
  const suggestedLibraries = item.metadata?.suggestedLibraries || [];
  const allLibraries = libraries || []; // Fallback to the full list if item has no suggestions

  // Combine suggested and all libraries, prioritizing suggestions and removing duplicates
  const combinedLibrariesMap = new Map<string, { id: string; name: string; score?: number }>();

  // Add suggested libraries first (they might have scores)
  suggestedLibraries.forEach(lib => {
    if (!combinedLibrariesMap.has(lib.id)) {
      combinedLibrariesMap.set(lib.id, lib);
    }
  });

  // Add remaining libraries from the full list
  allLibraries.forEach(lib => {
    if (!combinedLibrariesMap.has(lib.id)) {
      combinedLibrariesMap.set(lib.id, lib);
    }
  });

  const combinedLibraries = Array.from(combinedLibrariesMap.values());

  // Filter libraries based on search query
  const filteredLibraries = combinedLibraries.filter(lib =>
    lib.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort filtered libraries: suggested first (if any), then alphabetically
  filteredLibraries.sort((a, b) => {
      const aIsSuggested = suggestedLibraries.some(s => s.id === a.id);
      const bIsSuggested = suggestedLibraries.some(s => s.id === b.id);
      if (aIsSuggested && !bIsSuggested) return -1;
      if (!aIsSuggested && bIsSuggested) return 1;
      // Optionally sort by score if available within suggestions
      // if (aIsSuggested && bIsSuggested && a.score && b.score) return b.score - a.score;
      return a.name.localeCompare(b.name); // Alphabetical fallback
  });


  const handleSelect = (libraryId: string) => {
    setSelectedLibrary(libraryId);
  };

  const handleConfirm = () => {
    if (selectedLibrary) {
      // Find the full library object (including name) from the combined list
      const library = combinedLibraries.find(lib => lib.id === selectedLibrary);
      if (library) {
        onSelect(item.id, library.id, library.name); // Pass id and name
      } else {
         console.error("Selected library not found in the list:", selectedLibrary);
      }
    }
    onClose(); // Close dialog regardless of selection
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ?
            <span key={i} className="bg-yellow-200">{part}</span> : part
        )}
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Select Library</DialogTitle>
          <DialogDescription>
            Choose the appropriate library for the file: <span className="font-bold">{item.filename}</span>
            {item.metadata?.suggestedCollection && (
              <div className="mt-1 text-sm">
                The video will be added to collection: <span className="font-bold">{item.metadata.suggestedCollection}</span>
              </div>
            )}
             {item.metadata?.confidence !== undefined && item.metadata.confidence < 80 && (
               <div className="mt-1 text-sm text-orange-600">
                 (Low confidence match: {item.metadata.confidence.toFixed(0)}%)
               </div>
             )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Input
            placeholder="Search for library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2"
          />

          <ScrollArea className="h-80">
            <div className="space-y-1">
              {filteredLibraries.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No matching libraries found
                </div>
              ) : (
                filteredLibraries.map(lib => (
                  <div
                    key={lib.id}
                    className={`p-2 border rounded-md cursor-pointer transition-colors ${
                      selectedLibrary === lib.id
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted'
                    } ${suggestedLibraries.some(s => s.id === lib.id) ? 'border-dashed border-gray-400' : ''}`} // Indicate suggested
                    onClick={() => handleSelect(lib.id)}
                  >
                    <div className="font-medium">
                      {highlightMatch(lib.name, searchQuery)}
                      {suggestedLibraries.some(s => s.id === lib.id) && <span className="text-xs text-blue-500 ml-2">(Suggested)</span>}
                    </div>
                    {/* Display score if available from suggestions */}
                    {lib.score !== undefined && lib.score > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Match Score: {Math.round(lib.score)}%
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selectedLibrary}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualLibrarySelector;
