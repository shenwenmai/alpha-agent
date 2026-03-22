import MiniSearch from 'minisearch';

export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata?: any;
}

class RagService {
  private miniSearch: MiniSearch;
  private isReady: boolean = false;
  private chunks: KnowledgeChunk[] = [];

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['content'], // fields to index for full-text search
      storeFields: ['content', 'metadata'], // fields to return with search results
      searchOptions: {
        boost: { content: 2 },
        fuzzy: 0.2, // Enable fuzzy matching for typos
        prefix: true
      }
    });
    
    // Try to load from localStorage on init
    this.loadFromStorage();
  }

  // Chunking strategy: Split by headers or paragraphs
  // Simple implementation: Split by double newlines
  private chunkText(text: string): KnowledgeChunk[] {
    // Remove code blocks to avoid noise? Or keep them? Let's keep them.
    // Split by headers (#, ##, ###) or double newlines
    
    // 1. Split by headers (rough heuristic)
    const sections = text.split(/^#+\s+/gm);
    
    const chunks: KnowledgeChunk[] = [];
    let idCounter = 0;

    sections.forEach(section => {
      if (!section.trim()) return;
      
      // Further split long sections by paragraphs
      const paragraphs = section.split(/\n\n+/);
      
      paragraphs.forEach(para => {
        const content = para.trim();
        if (content.length < 20) return; // Skip very short noise
        
        chunks.push({
          id: `chunk_${Date.now()}_${idCounter++}`,
          content: content,
          metadata: { source: 'user-upload' }
        });
      });
    });

    return chunks;
  }

  public async ingest(fileContent: string): Promise<number> {
    console.log("[RAG] Ingesting file content...");
    this.chunks = this.chunkText(fileContent);
    
    this.miniSearch.removeAll();
    this.miniSearch.addAll(this.chunks);
    
    this.isReady = true;
    this.saveToStorage();
    
    console.log(`[RAG] Indexed ${this.chunks.length} chunks.`);
    return this.chunks.length;
  }

  public search(query: string, limit: number = 3): string[] {
    if (!this.isReady) return [];

    // Search with MiniSearch
    const results = this.miniSearch.search(query);
    
    // Map back to content and limit
    return results.slice(0, limit).map(r => r.content);
  }

  public clear() {
    this.miniSearch.removeAll();
    this.chunks = [];
    this.isReady = false;
    localStorage.removeItem('rag_data');
  }

  private saveToStorage() {
    try {
      // Only save raw chunks to save space, rebuild index on load
      // MiniSearch serialization is also possible but might be larger
      if (this.chunks.length > 5000) {
          console.warn("[RAG] Too many chunks to save to localStorage. Skipping persistence.");
          return;
      }
      localStorage.setItem('rag_data', JSON.stringify(this.chunks));
    } catch (e) {
      console.error("[RAG] Failed to save to localStorage (quota exceeded?)", e);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem('rag_data');
      if (data) {
        this.chunks = JSON.parse(data);
        this.miniSearch.addAll(this.chunks);
        this.isReady = true;
        console.log(`[RAG] Loaded ${this.chunks.length} chunks from storage.`);
      }
    } catch (e) {
      console.error("[RAG] Failed to load from localStorage", e);
    }
  }
  
  public getStatus() {
      return {
          ready: this.isReady,
          count: this.chunks.length
      };
  }
}

export const ragService = new RagService();
