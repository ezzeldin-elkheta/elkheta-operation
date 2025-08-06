import { NextRequest, NextResponse } from 'next/server';

// Mock data to simulate Bunny.net API response
const mockLibrariesResponse = {
  "Items": [
    {
      "Id": "297723",
      "Name": "Demo Library 1",
      "VideoCount": 245,
      "StorageUsage": 350000000,
      "TrafficUsage": 1500000000,
      "DateCreated": "2023-01-15T10:30:45Z",
      "ApiKey": "demo-api-key-1",
      "ReplicationRegions": ["EU"],
      "EnabledResolutions": "240p,360p,480p,720p,1080p",
      "Bitrate240p": 500000,
      "Bitrate360p": 800000,
      "Bitrate480p": 1500000,
      "Bitrate720p": 2500000,
      "Bitrate1080p": 4500000,
      "Bitrate1440p": 0,
      "Bitrate2160p": 0,
      "AllowDirectPlay": true,
      "EnableMP4Fallback": true,
      "KeepOriginalFiles": true,
      "PlayerKeyColor": "#3498db",
      "FontFamily": "Arial"
    },
    {
      "Id": "297724",
      "Name": "S2-PHYS-EN-P0122-Mohamed Khairy",
      "VideoCount": 32,
      "StorageUsage": 150000000,
      "TrafficUsage": 750000000,
      "DateCreated": "2023-05-22T14:15:30Z",
      "ApiKey": "demo-api-key-2",
      "ReplicationRegions": ["US"],
      "EnabledResolutions": "240p,360p,480p,720p",
      "Bitrate240p": 500000,
      "Bitrate360p": 800000,
      "Bitrate480p": 1500000,
      "Bitrate720p": 2500000,
      "Bitrate1080p": 0,
      "Bitrate1440p": 0,
      "Bitrate2160p": 0,
      "AllowDirectPlay": true,
      "EnableMP4Fallback": true,
      "KeepOriginalFiles": false,
      "PlayerKeyColor": "#e74c3c",
      "FontFamily": "Roboto"
    }
  ],
  "TotalItems": 2
};

// Mock collections response
const mockCollectionsResponse = {
  "Items": [
    {
      "id": "c1",
      "guid": "c1",
      "name": "T2-2026",
      "videoCount": 15,
      "totalSize": 750000000,
      "previewVideoIds": null,
      "previewImageUrls": [],
      "dateCreated": "2025-06-15T09:25:30Z"
    },
    {
      "id": "c2",
      "guid": "c2",
      "name": "T1-2026",
      "videoCount": 8,
      "totalSize": 420000000,
      "previewVideoIds": null,
      "previewImageUrls": [],
      "dateCreated": "2025-04-10T11:45:15Z"
    }
  ],
  "TotalItems": 2
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  console.log(`[Mock API] Handling request for ${path}`);
  
  // Return mock libraries data
  if (path.includes('/api/mock-libraries')) {
    console.log('[Mock API] Returning mock libraries data');
    return NextResponse.json(mockLibrariesResponse);
  }
  
  // Return mock collections if path includes a specific library ID and collections
  if (path.includes('/collections')) {
    console.log('[Mock API] Returning mock collections data');
    return NextResponse.json(mockCollectionsResponse);
  }
  
  // Default fallback
  return NextResponse.json({ error: "Not found" }, { status: 404 });
} 