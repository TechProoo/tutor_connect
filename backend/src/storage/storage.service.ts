import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Private object storage for guide PDFs and rendered page images.
 *
 * Uses a Supabase Storage bucket when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * are configured, and otherwise falls back to a local folder so the whole
 * system runs offline in development. Objects are never public — everything is
 * read server-side and streamed through authenticated endpoints.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private bucket = 'guides';
  private localRoot = path.join(process.cwd(), '.storage');

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = this.config.get<string>('SUPABASE_BUCKET') ?? 'guides';

    if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
      // Make sure the (private) bucket exists.
      const { data } = await this.supabase.storage.getBucket(this.bucket);
      if (!data) {
        await this.supabase.storage.createBucket(this.bucket, { public: false });
        this.logger.log(`Created private storage bucket "${this.bucket}"`);
      }
      this.logger.log('Storage driver: Supabase');
    } else {
      await fs.mkdir(this.localRoot, { recursive: true });
      this.logger.warn(
        '================================================================',
      );
      this.logger.warn('Storage driver: LOCAL DISK — not suitable for production.');
      this.logger.warn(
        `Guide pages are written to ${this.localRoot}, which is per-machine and`,
      );
      this.logger.warn(
        'wiped on every deploy. Because the database is shared, a guide uploaded',
      );
      this.logger.warn(
        'elsewhere will look READY but its pages will be missing here.',
      );
      this.logger.warn(
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to fix this.',
      );
      this.logger.warn(
        '================================================================',
      );
    }
  }

  get driver(): 'supabase' | 'local' {
    return this.supabase ? 'supabase' : 'local';
  }

  private localPath(key: string) {
    return path.join(this.localRoot, key.replace(/\//g, path.sep));
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(key, body, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      return;
    }
    const file = this.localPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async get(key: string): Promise<Buffer> {
    if (this.supabase) {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .download(key);
      if (error || !data) {
        throw new Error(`Storage read failed: ${error?.message ?? 'not found'}`);
      }
      return Buffer.from(await data.arrayBuffer());
    }
    return fs.readFile(this.localPath(key));
  }

  async remove(keys: string[]): Promise<void> {
    if (!keys.length) return;
    if (this.supabase) {
      await this.supabase.storage.from(this.bucket).remove(keys);
      return;
    }
    await Promise.all(
      keys.map((k) => fs.rm(this.localPath(k), { force: true }).catch(() => undefined)),
    );
  }

  /** Delete every object under a prefix (e.g. all pages of one guide version). */
  async removePrefix(prefix: string): Promise<void> {
    if (this.supabase) {
      const { data } = await this.supabase.storage.from(this.bucket).list(prefix);
      if (data?.length) {
        await this.supabase.storage
          .from(this.bucket)
          .remove(data.map((f) => `${prefix}/${f.name}`));
      }
      return;
    }
    await fs
      .rm(this.localPath(prefix), { recursive: true, force: true })
      .catch(() => undefined);
  }
}
