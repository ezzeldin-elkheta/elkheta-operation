import { HttpClient } from '../http-client';
import { Collection } from '../types';

export class CollectionsService {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async getCollections(libraryId: string, page: number = 1, itemsPerPage: number = 100, orderBy: string = 'date'): Promise<Collection[]> {
    console.log(`Fetching collections for library ${libraryId}`);
    
    const params = new URLSearchParams({
      page: page.toString(),
      itemsPerPage: itemsPerPage.toString(),
      orderBy
    });

    const response = await this.httpClient.get(`/api/proxy/video/library/${libraryId}/collections?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch collections: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }
}
