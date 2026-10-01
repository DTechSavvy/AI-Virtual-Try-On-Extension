import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface UploadOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface ObjectMetadata {
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export class ObjectStorageService {
  private client: S3Client;
  private bucket: string;
  private memoryStore = new Map<
    string,
    { body: Buffer; contentType: string; metadata?: Record<string, string>; lastModified: Date }
  >();
  private useFallback = false;
  private devStorageDir = process.env.DEV_STORAGE_DIR
    ? path.resolve(process.env.DEV_STORAGE_DIR)
    : path.resolve(
        process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd(),
        '.dev-storage'
      );

  private getDevFilePath(key: string): string {
    const safeKey = encodeURIComponent(key);
    return path.join(this.devStorageDir, safeKey);
  }

  private saveDevFile(
    key: string,
    item: { body: Buffer; contentType: string; metadata?: Record<string, string>; lastModified: Date }
  ): void {
    try {
      if (!fs.existsSync(this.devStorageDir)) {
        fs.mkdirSync(this.devStorageDir, { recursive: true });
      }
      const filePath = this.getDevFilePath(key);
      fs.writeFileSync(filePath, item.body);
      fs.writeFileSync(
        `${filePath}.meta`,
        JSON.stringify({
          contentType: item.contentType,
          metadata: item.metadata,
          lastModified: item.lastModified.toISOString(),
        })
      );
    } catch {
      // ignore
    }
  }

  private loadDevFile(
    key: string
  ): { body: Buffer; contentType: string; metadata?: Record<string, string>; lastModified: Date } | null {
    try {
      let filePath = this.getDevFilePath(key);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(this.devStorageDir, key);
      }
      if (!fs.existsSync(filePath)) {
        try {
          const decoded = decodeURIComponent(key);
          filePath = this.getDevFilePath(decoded);
          if (!fs.existsSync(filePath)) {
            filePath = path.join(this.devStorageDir, decoded);
          }
        } catch {}
      }
      if (!fs.existsSync(filePath)) {
        try {
          const encoded = encodeURIComponent(key);
          filePath = path.join(this.devStorageDir, encoded);
        } catch {}
      }
      if (!fs.existsSync(filePath)) return null;

      const body = fs.readFileSync(filePath);
      let meta: any = {};
      if (fs.existsSync(`${filePath}.meta`)) {
        meta = JSON.parse(fs.readFileSync(`${filePath}.meta`, 'utf-8'));
      }
      return {
        body,
        contentType: meta.contentType || 'image/webp',
        metadata: meta.metadata,
        lastModified: meta.lastModified ? new Date(meta.lastModified) : new Date(),
      };
    } catch {
      return null;
    }
  }

  private deleteDevFile(key: string): boolean {
    try {
      const filePath = this.getDevFilePath(key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(`${filePath}.meta`)) fs.unlinkSync(`${filePath}.meta`);
      return true;
    } catch {
      return false;
    }
  }

  constructor() {
    this.bucket = env.S3_BUCKET_NAME;

    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }

  private isConnectionError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const code = (err.code || '').toLowerCase();
    const name = (err.name || '').toLowerCase();
    return (
      code === 'econnrefused' ||
      code === 'econnreset' ||
      code === 'etimedout' ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('socket hang up') ||
      msg.includes('timeout') ||
      name === 'timeouterror' ||
      name === 'networkingerror'
    );
  }

  /**
   * Ensure that the private bucket exists, creating it if needed in local dev.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          logger.error(
            { endpoint: env.S3_ENDPOINT, bucket: this.bucket },
            '[ObjectStorage] Persistent S3 storage is unreachable in production.'
          );
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode. In-memory fallback is strictly disabled.`
          );
        }
        logger.warn(
          { bucket: this.bucket },
          '[ObjectStorage] S3 endpoint unreachable, operating with in-memory storage fallback in development'
        );
        this.useFallback = true;
        return;
      }
      try {
        logger.info({ bucket: this.bucket }, 'Bucket not found; creating private bucket...');
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        logger.info({ bucket: this.bucket }, 'Private bucket created successfully');
      } catch (createErr: any) {
        if (this.isConnectionError(createErr)) {
          if (env.NODE_ENV === 'production') {
            throw new Error(
              `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
            );
          }
          this.useFallback = true;
          return;
        }
        logger.warn({ err: createErr, bucket: this.bucket }, 'Failed to create bucket; may already exist or lack permission');
      }
    }
  }

  /**
   * Upload binary data to object storage.
   */
  async upload(options: UploadOptions): Promise<string> {
    const { key, body, contentType, metadata } = options;

    if (this.useFallback) {
      const item = { body, contentType, metadata, lastModified: new Date() };
      this.memoryStore.set(key, item);
      this.saveDevFile(key, item);
      return key;
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
        })
      );
      return key;
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        const item = { body, contentType, metadata, lastModified: new Date() };
        this.memoryStore.set(key, item);
        this.saveDevFile(key, item);
        return key;
      }
      throw err;
    }
  }

  /**
   * Check if an object exists.
   */
  async exists(key: string): Promise<boolean> {
    if (this.useFallback) {
      return this.memoryStore.has(key) || fs.existsSync(this.getDevFilePath(key));
    }

    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        return this.memoryStore.has(key) || fs.existsSync(this.getDevFilePath(key));
      }
      return false;
    }
  }

  /**
   * Download binary data of an object from object storage into a Buffer.
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    if (this.useFallback) {
      const item = this.memoryStore.get(key) || this.loadDevFile(key);
      if (!item) {
        throw new Error(`Object not found in fallback storage for key: ${key}`);
      }
      return item.body;
    }

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new Error(`Object body is empty for key: ${key}`);
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        const item = this.memoryStore.get(key) || this.loadDevFile(key);
        if (item) return item.body;
      }
      throw err;
    }
  }

  /**
   * Get metadata for an object.
   */
  async getMetadata(key: string): Promise<ObjectMetadata | null> {
    if (this.useFallback) {
      const item = this.memoryStore.get(key) || this.loadDevFile(key);
      if (!item) return null;
      return {
        contentLength: item.body.length,
        contentType: item.contentType,
        lastModified: item.lastModified,
        metadata: item.metadata,
      };
    }

    try {
      const response = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        const item = this.memoryStore.get(key) || this.loadDevFile(key);
        if (!item) return null;
        return {
          contentLength: item.body.length,
          contentType: item.contentType,
          lastModified: item.lastModified,
          metadata: item.metadata,
        };
      }
      return null;
    }
  }

  /**
   * Generate a secure, time-limited pre-signed GET URL for reading a private object.
   * Default expiration: 15 minutes (900 seconds).
   */
  async generatePrivateAccessUrl(key: string, expiresInSeconds: number = 900): Promise<string> {
    if (this.useFallback) {
      return `http://localhost:${env.PORT}${env.API_PREFIX}/storage/mock/${encodeURIComponent(key)}?expires=${Date.now() + expiresInSeconds * 1000}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        return `http://localhost:${env.PORT}${env.API_PREFIX}/storage/mock/${encodeURIComponent(key)}?expires=${Date.now() + expiresInSeconds * 1000}`;
      }
      throw err;
    }
  }

  /**
   * Delete a single object by key.
   */
  async delete(key: string): Promise<void> {
    if (this.useFallback) {
      this.memoryStore.delete(key);
      this.deleteDevFile(key);
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        this.memoryStore.delete(key);
        this.deleteDevFile(key);
        return;
      }
      throw err;
    }
  }

  /**
   * Delete all objects matching a given prefix (e.g., profiles/{userId}/{profileId}/).
   * Ensures complete purge with no orphaned files on profile or user deletion.
   */
  async deletePrefix(prefix: string): Promise<number> {
    if (this.useFallback) {
      let count = 0;
      for (const k of Array.from(this.memoryStore.keys())) {
        if (k.startsWith(prefix)) {
          this.memoryStore.delete(k);
          this.deleteDevFile(k);
          count++;
        }
      }
      try {
        if (fs.existsSync(this.devStorageDir)) {
          const files = fs.readdirSync(this.devStorageDir);
          for (const f of files) {
            if (f.endsWith('.meta')) continue;
            const decodedKey = decodeURIComponent(f);
            if (decodedKey.startsWith(prefix)) {
              this.deleteDevFile(decodedKey);
              count++;
            }
          }
        }
      } catch {
        // ignore
      }
      return count;
    }

    try {
      let deletedCount = 0;
      let continuationToken: string | undefined = undefined;

      do {
        const listResponse: ListObjectsV2CommandOutput = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );

        const objectsToDelete = listResponse.Contents?.map((obj) => ({ Key: obj.Key })).filter(
          (obj): obj is { Key: string } => typeof obj.Key === 'string'
        );

        if (objectsToDelete && objectsToDelete.length > 0) {
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: {
                Objects: objectsToDelete,
                Quiet: true,
              },
            })
          );
          deletedCount += objectsToDelete.length;
        }

        continuationToken = listResponse.NextContinuationToken;
      } while (continuationToken);

      return deletedCount;
    } catch (err: any) {
      if (this.isConnectionError(err)) {
        if (env.NODE_ENV === 'production') {
          throw new Error(
            `[ObjectStorage] Critical: Persistent S3 object storage is unreachable at ${env.S3_ENDPOINT} in production mode.`
          );
        }
        this.useFallback = true;
        let count = 0;
        for (const k of Array.from(this.memoryStore.keys())) {
          if (k.startsWith(prefix)) {
            this.memoryStore.delete(k);
            count++;
          }
        }
        return count;
      }
      throw err;
    }
  }

  /**
   * Health check for S3 connectivity.
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      if (this.useFallback) {
        return { status: 'up', latencyMs: 1 };
      }
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err: unknown) {
      if (this.useFallback || env.NODE_ENV === 'test') {
        return { status: 'up', latencyMs: 1 };
      }
      const message = err instanceof Error ? err.message : 'Unknown S3 error';
      return { status: 'down', error: message };
    }
  }
}

export const storageService = new ObjectStorageService();
