import React, { useState } from "react";
import { Label } from "../src/components/ui/label";
import { Input } from "../src/components/ui/input";
import { ScrollArea } from "../src/components/ui/scroll-area";
import { cn } from "../src/lib/utils";
import { Search } from "lucide-react";

interface CollectionSelectorProps {
  collections: Array<{ id: string; name: string }>;
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  disabled?: boolean;
  suggestedCollection?: string;
}

const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections = [], // Add default empty array
  selectedCollection,
  onCollectionChange,
  disabled,
  suggestedCollection
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Helper to highlight suggested collection
  const isCollectionSuggested = (name: string) => {
    return !!suggestedCollection && suggestedCollection.toLowerCase() === name.toLowerCase();
  };

  // Filter collections based on search query
  const filteredCollections = collections.filter(collection => 
    collection.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label>Collection</Label>
      
      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search collections..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
        />
      </div>
      
      <ScrollArea className={cn(
        "h-[200px] rounded-md border",
        disabled && "opacity-50"
      )}>
        <div className="p-4">
          {filteredCollections.length > 0 ? (
            filteredCollections.map((collection) => (
              <div
                key={collection.id}
                className={cn(
                  "p-2 cursor-pointer rounded-md transition-colors",
                  selectedCollection === collection.id 
                    ? "bg-blue-100 hover:bg-blue-200" 
                    : isCollectionSuggested(collection.name)
                      ? "bg-green-50 hover:bg-green-100"
                      : "hover:bg-gray-100",
                  disabled && "cursor-not-allowed"
                )}
                onClick={() => !disabled && onCollectionChange(collection.id)}
              >
                <div className="flex justify-between items-center">
                  <span>{collection.name}</span>
                  {isCollectionSuggested(collection.name) && (
                    <span className="text-xs text-green-600 font-medium">Suggested</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-4">
              {searchQuery ? 
                "No collections matching your search" :
                (disabled 
                  ? "Select a library first to view available collections" 
                  : "No collections available for this library")
              }
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CollectionSelector;
