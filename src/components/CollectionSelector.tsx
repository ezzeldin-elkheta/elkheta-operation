import React from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { Collection } from "@/lib/bunny/types";

interface CollectionSelectorProps {
  collections: Collection[];
  selectedCollection: string;
  onCollectionChange: (value: string) => void;
  disabled?: boolean;
}

const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections = [],
  selectedCollection,
  onCollectionChange,
  disabled
}) => {
  const handleCollectionClick = (collection: Collection) => {
    if (!disabled) {
      const collectionId = collection.id || collection.guid;
      if (collectionId) {
        console.log('[CollectionSelector] Selection changed:', {
          from: selectedCollection,
          to: collectionId,
          collectionName: collection.name
        });
        onCollectionChange(collectionId);
      } else {
        console.warn('[CollectionSelector] Collection has no id or guid:', collection);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>Collection</Label>
      <ScrollArea className={cn(
        "h-[200px] rounded-md border",
        disabled && "opacity-50"
      )}>
        <div className="p-4">
          {collections?.length > 0 ? (
            <div className="space-y-1">
              {collections.map((collection, index) => {
                const collectionId = collection.id || collection.guid;
                return (
                  <div
                    key={`collection-${collectionId || index}`}
                    className={cn(
                      "p-2 cursor-pointer rounded-md transition-colors",
                      selectedCollection === collectionId
                        ? "bg-blue-100 hover:bg-blue-200" 
                        : "hover:bg-gray-100",
                      disabled && "cursor-not-allowed"
                    )}
                    onClick={() => handleCollectionClick(collection)}
                  >
                    {collection.name}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              {disabled 
                ? "Select a library first to view collections" 
                : "No collections available"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CollectionSelector;