import React from 'react';
import ProcessingQueue from '../ProcessingQueue';
import { Upload } from 'lucide-react';

interface ProcessingQueueSectionProps {
  uploadGroups: any[];
  libraries: any[];
  isGloballyPaused: boolean;
  onUpdateMetadata: (fileId: string, libraryId: string, libraryName: string) => void;
  onPauseUpload: (fileId: string) => void;
  onResumeUpload: (fileId: string) => void;
  onCancelUpload: (fileId: string) => void;
  onGlobalPauseToggle: () => void;
}

const ProcessingQueueSection: React.FC<ProcessingQueueSectionProps> = ({
  uploadGroups,
  libraries,
  isGloballyPaused,
  onUpdateMetadata,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onGlobalPauseToggle
}) => {
  return (
    <section className="mt-6 mb-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Upload className="h-5 w-5 text-blue-500 animate-pulse-slow" />
        <h3 className="text-lg font-semibold">Upload Status</h3>
      </div>
      <div className="glass-effect rounded-lg p-4">
        <ProcessingQueue 
          groups={uploadGroups}
          libraries={libraries}
          onUpdateMetadata={onUpdateMetadata}
          onPauseUpload={onPauseUpload}
          onResumeUpload={onResumeUpload}
          onCancelUpload={onCancelUpload}
          onGlobalPauseToggle={onGlobalPauseToggle}
          isGloballyPaused={isGloballyPaused}
        />
      </div>
    </section>
  );
};

export default ProcessingQueueSection;
