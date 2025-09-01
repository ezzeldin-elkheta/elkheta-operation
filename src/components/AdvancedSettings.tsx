import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Settings } from 'lucide-react';

interface AdvancedSettingsProps {
  settings: {
    chunkSize: number;
    maxConcurrentUploads: number;
    useStreamingUpload: boolean;
  };
  onSettingsChange: (settings: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ settings, onSettingsChange }) => {
  const [chunkSizeMB, setChunkSizeMB] = useState(settings.chunkSize / (1024 * 1024));
  const [concurrentUploads, setConcurrentUploads] = useState(settings.maxConcurrentUploads);
  const [useStreaming, setUseStreaming] = useState(settings.useStreamingUpload);

  // Update local state if props change
  useEffect(() => {
    setChunkSizeMB(settings.chunkSize / (1024 * 1024));
    setConcurrentUploads(settings.maxConcurrentUploads);
    setUseStreaming(settings.useStreamingUpload);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange({
      chunkSize: chunkSizeMB * 1024 * 1024,
      maxConcurrentUploads: concurrentUploads,
      useStreamingUpload: useStreaming
    });
    // Optionally close the dialog after saving
    // Find a way to trigger close if needed, maybe pass an onClose prop
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Advanced Upload Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Advanced Upload Settings</DialogTitle>
          <DialogDescription>
            Adjust upload parameters to optimize performance based on your internet speed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="chunk-size">Chunk Size (MB): {chunkSizeMB}</Label>
              {/* Tooltip or info icon could go here */}
            </div>
            <Slider
              id="chunk-size"
              min={5} // Min 5MB
              max={100} // Max 100MB
              step={5}
              value={[chunkSizeMB]}
              onValueChange={(value) => setChunkSizeMB(value[0])}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Larger chunks might be faster but use more memory. Recommended: 20-50MB.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="concurrent-uploads">Max Concurrent Uploads: {concurrentUploads}</Label>
            </div>
            <Slider
              id="concurrent-uploads"
              min={1}
              max={10}
              step={1}
              value={[concurrentUploads]}
              onValueChange={(value) => setConcurrentUploads(value[0])}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              More uploads can speed up the total time but might slow down individual files.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="streaming-upload" 
              checked={useStreaming}
              onCheckedChange={(checked) => setUseStreaming(Boolean(checked))}
            />
            <Label htmlFor="streaming-upload">Use Streaming Upload</Label>
          </div>
           <p className="text-xs text-gray-500">
              Streaming upload is generally faster and uses less memory, especially for large files. Disable only if experiencing issues.
            </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSettings;
