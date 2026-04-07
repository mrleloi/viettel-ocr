import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IFileStorage } from '../../domain/shared/file-storage';
import { EnvConfigService } from '../config/env-config.service';

/**
 * Local filesystem storage implementing the IFileStorage domain port.
 *
 * All file operations are scoped to the configured data directory.
 * Includes path traversal protection to prevent directory escape.
 */
@Injectable()
export class LocalFileStorage implements IFileStorage {
  private readonly dataDir: string;

  constructor(
    config: EnvConfigService,
  ) {
    this.dataDir = path.resolve(config.dataDir);
  }

  /**
   * Save a file to storage, creating parent directories as needed.
   * @param relativePath - Path relative to data dir
   * @param content - File content as Buffer
   */
  async saveFile(relativePath: string, content: Buffer): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  /**
   * Read a file from storage.
   * @param relativePath - Path relative to data dir
   * @returns File content as Buffer
   * @throws Error if file does not exist
   */
  async readFile(relativePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(relativePath);
    return fs.readFile(fullPath);
  }

  /**
   * Read a file and return as Base64 string.
   * @param relativePath - Path relative to data dir
   * @returns Base64-encoded file content
   * @throws Error if file does not exist
   */
  async readFileAsBase64(relativePath: string): Promise<string> {
    const buffer = await this.readFile(relativePath);
    return buffer.toString('base64');
  }

  /**
   * Check if a file exists.
   * @param relativePath - Path relative to data dir
   * @returns true if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file from storage.
   * @param relativePath - Path relative to data dir
   * @throws Error if file does not exist
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.unlink(fullPath);
  }

  /**
   * List filenames in a directory.
   * @param relativeDirPath - Directory path relative to data dir
   * @returns Array of filenames (not full paths)
   */
  async listFiles(relativeDirPath: string): Promise<string[]> {
    const fullPath = this.resolvePath(relativeDirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  }

  /**
   * Ensure a directory exists, creating it and any parent directories if needed.
   * @param relativeDirPath - Directory path relative to data dir
   */
  async ensureDir(relativeDirPath: string): Promise<void> {
    const fullPath = this.resolvePath(relativeDirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  /**
   * Resolve a relative path to an absolute path within the data directory.
   * Validates against path traversal attacks.
   * @param relativePath - Path relative to data dir
   * @returns Absolute path
   * @throws Error if path contains traversal sequences
   */
  private resolvePath(relativePath: string): string {
    // Reject path traversal attempts
    if (relativePath.includes('..')) {
      throw new Error(
        `Path traversal detected: "${relativePath}" — paths must not contain ".."`,
      );
    }

    return path.join(this.dataDir, relativePath);
  }
}
