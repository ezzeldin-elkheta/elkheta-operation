import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { formatBytes, formatUploadSpeed, formatTimeRemaining } from '../lib/utils';
import { Upload, CheckCircle, AlertCircle, Pause, Play } from 'lucide-react';

interface MockUploadProgress {
  filename: string;
  progress: number;
  uploadedSize: number;
  totalSize: number;
  uploadSpeed: number;
  timeRemaining: number;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'paused';
}

const UploadTestDemo: React.FC = () => {
  const [uploads, setUploads] = useState<MockUploadProgress[]>([
    {
      filename: 'lecture-physics-quantum-mechanics.mp4',
      progress: 0,
      uploadedSize: 0,
      totalSize: 250 * 1024 * 1024, // 250 MB
      uploadSpeed: 0,
      timeRemaining: 0,
      status: 'pending'
    },
    {
      filename: 'biology-cell-division-Q1.mp4',
      progress: 0,
      uploadedSize: 0,
      totalSize: 180 * 1024 * 1024, // 180 MB
      uploadSpeed: 0,
      timeRemaining: 0,
      status: 'pending'
    },
    {
      filename: 'mathematics-calculus-derivatives.mp4',
      progress: 0,
      uploadedSize: 0,
      totalSize: 320 * 1024 * 1024, // 320 MB
      uploadSpeed: 0,
      timeRemaining: 0,
      status: 'pending'
    }
  ]);

  const simulateUpload = (index: number) => {
    setUploads(prev => prev.map((upload, i) => 
      i === index ? { ...upload, status: 'processing' as const } : upload
    ));

    const interval = setInterval(() => {
      setUploads(prev => {
        const newUploads = [...prev];
        const upload = newUploads[index];
        
        if (upload.status !== 'processing') {
          clearInterval(interval);
          return prev;
        }

        // Simulate realistic upload progress
        const increment = Math.random() * 3 + 0.5; // 0.5% to 3.5% increment
        const newProgress = Math.min(upload.progress + increment, 100);
        const newUploadedSize = (newProgress / 100) * upload.totalSize;
        
        // Simulate realistic upload speed (2-15 MB/s)
        const baseSpeed = 5 * 1024 * 1024; // 5 MB/s base
        const speedVariation = (Math.random() - 0.5) * 2 * 1024 * 1024; // ±2 MB/s variation
        const newUploadSpeed = Math.max(1 * 1024 * 1024, baseSpeed + speedVariation);
        
        // Calculate time remaining
        const remainingBytes = upload.totalSize - newUploadedSize;
        const newTimeRemaining = remainingBytes / newUploadSpeed;

        newUploads[index] = {
          ...upload,
          progress: newProgress,
          uploadedSize: newUploadedSize,
          uploadSpeed: newUploadSpeed,
          timeRemaining: newTimeRemaining,
          status: newProgress >= 100 ? 'completed' : 'processing'
        };

        if (newProgress >= 100) {
          clearInterval(interval);
        }

        return newUploads;
      });
    }, 150); // Update every 150ms for smooth animation
  };

  const pauseUpload = (index: number) => {
    setUploads(prev => prev.map((upload, i) => 
      i === index ? { ...upload, status: 'paused' as const } : upload
    ));
  };

  const resumeUpload = (index: number) => {
    simulateUpload(index);
  };

  const resetDemo = () => {
    setUploads(prev => prev.map(upload => ({
      ...upload,
      progress: 0,
      uploadedSize: 0,
      uploadSpeed: 0,
      timeRemaining: 0,
      status: 'pending' as const
    })));
  };

  const totalSize = uploads.reduce((acc, upload) => acc + upload.totalSize, 0);
  const totalUploaded = uploads.reduce((acc, upload) => acc + upload.uploadedSize, 0);
  const totalProgress = totalSize > 0 ? (totalUploaded / totalSize) * 100 : 0;
  const totalSpeed = uploads
    .filter(upload => upload.status === 'processing')
    .reduce((acc, upload) => acc + upload.uploadSpeed, 0);
  
  const completedFiles = uploads.filter(upload => upload.status === 'completed').length;
  const processingFiles = uploads.filter(upload => upload.status === 'processing').length;
  const pendingFiles = uploads.filter(upload => upload.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Enhanced Upload Progress Demo
        </h2>
        <p className="text-gray-600">
          تجربة مميزة لمراقبة رفع الفيديوهات مع عرض النسبة المئوية وعداد الميجابايت في الوقت الفعلي
        </p>
      </div>

      {/* Global Progress Section */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-700">Overall Progress</span>
            <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
              <span className="font-mono font-medium text-blue-600">
                {formatBytes(totalUploaded, 1)}
              </span>
              <span className="text-gray-400">/</span>
              <span className="font-mono font-medium text-gray-700">
                {formatBytes(totalSize, 1)}
              </span>
            </div>
            {totalSpeed > 0 && (
              <div className="flex items-center gap-1 bg-green-100 px-3 py-1 rounded-full">
                <span className="text-green-600">↑</span>
                <span className="font-mono font-medium text-green-700">
                  {formatBytes(totalSpeed, 1)}/s
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">{Math.round(totalProgress)}%</span>
            {processingFiles > 0 && (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>
        
        <div className="relative mb-3">
          <Progress value={totalProgress} className="h-4" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium text-white drop-shadow-sm">
              {Math.round(totalProgress)}% ({completedFiles}/{uploads.length} files)
            </span>
          </div>
        </div>

        {/* Statistics */}
        <div className="flex justify-between items-center text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Completed: <strong>{completedFiles}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Processing: <strong>{processingFiles}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Pending: <strong>{pendingFiles}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span>
              Total Size: <strong>{((totalSize) / (1024 * 1024 * 1024)).toFixed(2)} GB</strong>
            </span>
            {totalSpeed > 0 && (
              <span>
                Avg Speed: <strong>{formatBytes(totalSpeed / Math.max(processingFiles, 1), 1)}/s per file</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Individual Files */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Individual File Progress</h3>
        
        {uploads.map((upload, index) => (
          <div key={index} className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="truncate font-medium text-gray-900">
                  {upload.filename}
                </span>
                {/* Real-time upload percentage next to filename */}
                {(upload.status === 'processing' || upload.status === 'paused') && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      {Math.round(upload.progress)}%
                    </span>
                    {upload.status === 'processing' && (
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {upload.status === 'paused' && (
                      <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                )}
                {upload.status === 'completed' && (
                  <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    100%
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {upload.status === 'pending' && (
                  <Button size="sm" onClick={() => simulateUpload(index)}>
                    <Upload className="w-4 h-4 mr-1" />
                    Start Upload
                  </Button>
                )}
                {upload.status === 'processing' && (
                  <Button size="sm" variant="outline" onClick={() => pauseUpload(index)}>
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
                {upload.status === 'paused' && (
                  <Button size="sm" variant="outline" onClick={() => resumeUpload(index)}>
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                {upload.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Enhanced Progress Section */}
            {(upload.status === 'processing' || upload.status === 'paused') && (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <div className="flex items-center gap-3">
                    {/* Enhanced MB counter */}
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                      <span className="font-mono font-medium text-blue-600">
                        {formatBytes(upload.uploadedSize, 1)}
                      </span>
                      <span className="text-gray-400">/</span>
                      <span className="font-mono font-medium">
                        {formatBytes(upload.totalSize, 1)}
                      </span>
                    </div>
                    
                    {/* Upload speed */}
                    <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                      <span className="text-green-600">↑</span>
                      <span className="font-mono font-medium text-green-700">
                        {formatUploadSpeed(upload.uploadSpeed)}
                      </span>
                    </div>

                    <div className="text-gray-500">
                      <span className="text-xs">
                        ({((upload.totalSize) / (1024 * 1024)).toFixed(1)} MB total)
                      </span>
                    </div>
                  </div>
                  
                  {/* Time remaining */}
                  {upload.timeRemaining > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                      <span className="text-blue-600">⏱</span>
                      <span className="font-mono text-blue-700">
                        {formatTimeRemaining(upload.timeRemaining)}
                      </span>
                      <span className="text-blue-600 text-xs">remaining</span>
                    </div>
                  )}
                </div>
                
                {/* Progress bar with percentage overlay */}
                <div className="relative">
                  <Progress value={upload.progress} className="h-3 w-full" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white drop-shadow-sm">
                      {Math.round(upload.progress)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {upload.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Upload completed successfully - {formatBytes(upload.totalSize)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Demo Controls */}
      <div className="flex justify-center gap-4 pt-4 border-t">
        <Button onClick={() => uploads.forEach((_, index) => simulateUpload(index))}>
          Start All Uploads
        </Button>
        <Button variant="outline" onClick={resetDemo}>
          Reset Demo
        </Button>
      </div>
    </div>
  );
};

export default UploadTestDemo; 