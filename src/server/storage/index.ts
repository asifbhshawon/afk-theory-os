import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface StorageAdapter {
  save(relativePath: string, buffer: Buffer, mimeType: string): Promise<void>;
  read(relativePath: string): Promise<Buffer | null>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}

// Local filesystem storage adapter
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");
  }

  private resolvePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/");
    const fullPath = path.resolve(this.baseDir, normalized);
    const rootWithSep = this.baseDir.endsWith(path.sep) ? this.baseDir : this.baseDir + path.sep;
    if (fullPath !== this.baseDir && !fullPath.startsWith(rootWithSep)) {
      throw new Error("Security violation: path traversal detected");
    }
    return fullPath;
  }

  async save(relativePath: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
  }

  async read(relativePath: string): Promise<Buffer | null> {
    try {
      const fullPath = this.resolvePath(relativePath);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath);
    } catch {
      return null;
    }
  }

  async delete(relativePath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Ignore deletion errors if file already removed
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(relativePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }
}

// Supabase cloud storage adapter (S3-compatible bucket)
export class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient | null = null;
  private bucket: string;
  private bucketChecked = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidence";

    if (supabaseUrl && supabaseKey) {
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client || this.bucketChecked) return;
    try {
      const { data: buckets } = await this.client.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === this.bucket);
      if (!exists) {
        await this.client.storage.createBucket(this.bucket, {
          public: false,
          fileSizeLimit: 30 * 1024 * 1024, // 30MB
        });
      }
      this.bucketChecked = true;
    } catch {
      // Bucket may already exist or creation managed externally
      this.bucketChecked = true;
    }
  }

  async save(relativePath: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (!this.client) {
      throw new Error("Supabase credentials not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required)");
    }
    await this.ensureBucket();
    const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const { error } = await this.client.storage.from(this.bucket).upload(cleanPath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
  }

  async read(relativePath: string): Promise<Buffer | null> {
    if (!this.client) return null;
    try {
      const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
      const { data, error } = await this.client.storage.from(this.bucket).download(cleanPath);
      if (error || !data) return null;
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  async delete(relativePath: string): Promise<void> {
    if (!this.client) return;
    try {
      const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
      await this.client.storage.from(this.bucket).remove([cleanPath]);
    } catch {
      // Ignore deletion errors
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const buf = await this.read(relativePath);
    return buf !== null;
  }
}

// Global cached adapter instance
let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;

  const provider = (process.env.STORAGE_PROVIDER || "").toLowerCase();
  const hasSupabaseEnv =
    !!process.env.SUPABASE_URL &&
    (!!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_ANON_KEY);

  if (provider === "supabase" || (hasSupabaseEnv && provider !== "local")) {
    cachedAdapter = new SupabaseStorageAdapter();
  } else {
    cachedAdapter = new LocalStorageAdapter();
  }

  return cachedAdapter;
}

export async function saveStorageFile(relativePath: string, buffer: Buffer, mimeType: string): Promise<void> {
  const adapter = getStorageAdapter();
  await adapter.save(relativePath, buffer, mimeType);
}

export async function readStorageFile(relativePath: string): Promise<Buffer | null> {
  const adapter = getStorageAdapter();
  return adapter.read(relativePath);
}

export async function deleteStorageFile(relativePath: string): Promise<void> {
  const adapter = getStorageAdapter();
  await adapter.delete(relativePath);
}

export async function storageFileExists(relativePath: string): Promise<boolean> {
  const adapter = getStorageAdapter();
  return adapter.exists(relativePath);
}
