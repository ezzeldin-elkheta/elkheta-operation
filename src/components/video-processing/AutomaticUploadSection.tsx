import React from 'react';
import UploadZone from '../UploadZone';
import SelectedFilesPreview from '../SelectedFilesPreview';

interface AutomaticUploadSectionProps {
  isAutoUploading: boolean;
  autoUploadFiles: File[];
  uploadInProgress: boolean; // General upload progress flag
  onFileSelect: (files: FileList) => void;
  onStartUpload: () => Promise<void>;
  onRemoveFile: (index: number) => void; // Changed to index
}

const AutomaticUploadSection: React.FC<AutomaticUploadSectionProps> = ({
  isAutoUploading,
  autoUploadFiles,
  uploadInProgress,
  onFileSelect,
  onStartUpload,
  onRemoveFile
}) => {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Automatic File Upload</h3>
        {/* Maybe add a status indicator here if needed */}
      </div>

      <UploadZone
        onFileSelect={onFileSelect}
        // Disable dropzone if any upload (auto or manual) is in progress
        disabled={uploadInProgress}
        files={autoUploadFiles} // Pass files to potentially display count inside
        onStartUpload={onStartUpload}
        isUploading={isAutoUploading} // Specific state for this section's button
      />

      {/* Show selected files preview for automatic upload */}
      {/* Only show preview if NOT uploading and files are selected */}
      {!uploadInProgress && autoUploadFiles.length > 0 && (
        <SelectedFilesPreview
          files={autoUploadFiles}
          onRemove={onRemoveFile} // Use index-based removal
          className="mt-2"
        />
      )}
    </section>
  );
};

export default AutomaticUploadSection;
