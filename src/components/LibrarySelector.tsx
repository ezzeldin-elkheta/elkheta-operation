import React, { useState, useMemo } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface Library {
  id: string;
  name: string;
  apiKey?: string;
  StorageZoneId?: string;
  PullZoneId?: string;
  apiEndpoint?: string;
  collections?: Array<{
    id: string;
    name: string;
    videoCount: number;
    totalSize: number;
    previewVideoIds: string[] | null;
    previewImageUrls: string[];
  }>;
}

interface LibrarySelectorProps {
  libraries: Library[];
  selectedLibrary: string;
  onLibraryChange: (value: string) => void;
  disabled?: boolean;
}

const LibrarySelector: React.FC<LibrarySelectorProps> = ({
  libraries,
  selectedLibrary,
  onLibraryChange,
  disabled
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLibraries = useMemo(() => {
    return libraries.filter((lib) =>
      lib.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [libraries, searchTerm]);

  const handleLibrarySelect = (libraryId: string) => {
    if (disabled) return;
    
    console.log('[LibrarySelector] Selecting library:', libraryId);
    const library = libraries.find(lib => lib.id === libraryId);
    if (library) {
      console.log('[LibrarySelector] Found library:', library);
      // Ensure we have all required fields
      const libraryWithDefaults = {
        ...library,
        apiKey: library.apiKey || '',
        StorageZoneId: library.StorageZoneId || '0',
        PullZoneId: library.PullZoneId || '0',
        apiEndpoint: library.apiEndpoint || `https://video.bunnycdn.com/library/${library.id}`
      };
      console.log('[LibrarySelector] Setting library with defaults:', libraryWithDefaults);
      onLibraryChange(libraryId);
    } else {
      console.error('[LibrarySelector] Library not found:', libraryId);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Library</Label>
      
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search libraries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-4 space-y-2">
          {filteredLibraries.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No libraries found
            </div>
          ) : (
            filteredLibraries.map((library) => (
              <div
                key={library.id}
                className={cn(
                  "p-2 cursor-pointer rounded-md transition-colors",
                  selectedLibrary === library.id
                    ? "bg-blue-100 hover:bg-blue-200"
                    : "hover:bg-gray-100"
                )}
                onClick={() => handleLibrarySelect(library.id)}
              >
                {library.name}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LibrarySelector;