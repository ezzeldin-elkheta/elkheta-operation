import React from "react";
import { Card } from "./ui/card";
import VideoProcessingForm from "./VideoProcessingForm";
import { bunnyService } from "../lib/bunny-service";
import { Year } from "../types/common";
import BunnyDiagnostics from "../lib/bunny/diagnostics";
// Use the types expected by VideoProcessingForm props
import { LibraryInterface, CollectionInterface } from './video-processing/types'; 

// Remove or comment out the unused import if no longer needed elsewhere
// import { LibraryInterface as DataLibraryInterface, CollectionInterface as DataCollectionInterface } from "../types/library-data";

// Keep original Library/Collection types if needed for fetching logic, but use the correct ones for state passed to the form
interface FetchedLibrary {
  id: string;
  name: string;
  apiKey: string;
  StorageZoneId?: string; // Keep optional based on source data
  PullZoneId?: string;  // Keep optional based on source data
  collections?: Array<{ id: string; name: string; }>; // Simplified for fetching
}

interface FetchedCollection {
  id: string;
  name: string;
  guid?: string; // Keep optional based on source data
}


const Home = () => {
  // Use the correct LibraryInterface for state passed to the form
  const [libraries, setLibraries] = React.useState<LibraryInterface[]>([]);
  // Use the correct CollectionInterface for state passed to the form
  const [collections, setCollections] = React.useState<CollectionInterface[]>([]);
  const [selectedLibrary, setSelectedLibrary] = React.useState("");
  const [selectedCollection, setSelectedCollection] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState<Year>("2026");

  // Initialize bunny service and fetch libraries on mount
  React.useEffect(() => {
    const initializeAndFetchLibraries = async () => {
      try {
        // Run diagnostics in development
        if (import.meta.env.DEV) {
          console.log('🔍 Running Bunny.net diagnostics...');
          await BunnyDiagnostics.runAllTests();
        }
        
        await bunnyService.initialize();
        const libs = await bunnyService.getLibraries(); // Assuming this returns FetchedLibrary compatible type
        // Transform fetched data to match the required LibraryInterface for the form
        const transformedLibs: LibraryInterface[] = libs.map((lib) => ({
          id: lib.id || "",
          name: lib.name || "Unnamed Library",
          apiKey: lib.apiKey || "",
          StorageZoneId: lib.StorageZoneId || "0", // Ensure required fields have defaults
          PullZoneId: lib.PullZoneId || "0",     // Ensure required fields have defaults
          collections: lib.collections?.map(c => ({ // Ensure collections structure matches
            id: c.id || "",
            guid: c.id || "", // Assuming guid is same as id if not present
            name: c.name || "Unnamed Collection",
            videoCount: 0, // Add default/required fields
            totalSize: 0,
            previewVideoIds: null,
            previewImageUrls: [],
            dateCreated: new Date().toISOString()
          })) || [], // Ensure collections is always an array
          // Add other required fields from LibraryInterface with defaults if necessary
          videoCount: lib.videoCount || 0,
          storageUsage: lib.storageUsage || 0,
          trafficUsage: lib.trafficUsage || 0,
          dateCreated: lib.dateCreated || new Date().toISOString(),
          storageZoneId: Number(lib.StorageZoneId) || 0,
          pullZoneId: Number(lib.PullZoneId) || 0,
          replicationRegions: lib.replicationRegions || [],
          enabledResolutions: lib.enabledResolutions || [],
          bitrate240p: lib.bitrate240p || 0,
          bitrate360p: lib.bitrate360p || 0,
          bitrate480p: lib.bitrate480p || 0,
          bitrate720p: lib.bitrate720p || 0,
          bitrate1080p: lib.bitrate1080p || 0,
          bitrate1440p: lib.bitrate1440p || 0,
          bitrate2160p: lib.bitrate2160p || 0,
          allowDirectPlay: lib.allowDirectPlay || false,
          enableMP4Fallback: lib.enableMP4Fallback || false,
          keepOriginalFiles: lib.keepOriginalFiles || false,
          playerKeyColor: lib.playerKeyColor || "#000000",
          fontFamily: lib.fontFamily || "Arial"
        }));
        setLibraries(transformedLibs);
      } catch (error) {
        console.error("❌ Error fetching libraries:", error);
      }
    };
    initializeAndFetchLibraries();
  }, []);

  // Fetch collections when library changes
  React.useEffect(() => {
    const fetchCollections = async () => {
      if (!selectedLibrary) return;
      try {
        const cols = await bunnyService.getCollections(selectedLibrary); // Assuming this returns FetchedCollection compatible type
        // Transform fetched data to match the required CollectionInterface for the form
        const transformedCols: CollectionInterface[] = cols.map((col) => ({
          id: col.id || col.guid || "", // Use id or guid
          guid: col.guid || col.id || "", // Ensure guid is present
          name: col.name || "Unnamed Collection",
          videoCount: col.videoCount || 0, // Add default/required fields
          totalSize: col.totalSize || 0,
          previewVideoIds: col.previewVideoIds || null,
          previewImageUrls: col.previewImageUrls || [],
          dateCreated: col.dateCreated || new Date().toISOString()
        }));
        setCollections(transformedCols);
      } catch (error) {
        console.error("Error fetching collections:", error);
        setCollections([]);
      }
    };
    fetchCollections();
  }, [selectedLibrary]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <img 
              src="/download.png" 
              alt="Elkheta Logo" 
              className="h-32 w-auto animate-pulse-slow" // Increased from h-20 to h-28
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 animate-slide-in"> {/* Reduced from text-3xl to text-2xl */}
                Elkheta Operation Upload Tool
              </h1>
              <p className="mt-2 text-sm text-gray-600 animate-slide-in" style={{ animationDelay: '0.2s' }}> {/* Reduced from default to text-sm */}
                Streamline your educational content management with powerful video processing
              </p>
            </div>
          </div>
        </div>

        <Card className="p-6">
          <VideoProcessingForm
            libraries={libraries}
            collections={collections}
            selectedLibrary={selectedLibrary}
            selectedCollection={selectedCollection}
            selectedYear={selectedYear}
            onLibraryChange={setSelectedLibrary}
            onCollectionChange={setSelectedCollection}
            onYearChange={setSelectedYear}
          />
        </Card>
      </div>
    </div>
  );
};

export default Home;
