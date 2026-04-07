/**
 * Domain port interface for file storage operations.
 *
 * Infrastructure implementations (e.g., LocalFileStorage) provide the
 * concrete filesystem integration. All paths are relative to the
 * configured data directory.
 */
export interface IFileStorage {
  /**
   * Save a file to storage.
   * Creates parent directories if they do not exist.
   * @param relativePath - Path relative to data dir (e.g., 'uploads/batch-1/invoice.pdf')
   * @param content - File content as Buffer
   */
  saveFile(relativePath: string, content: Buffer): Promise<void>;

  /**
   * Read a file from storage.
   * @param relativePath - Path relative to data dir
   * @returns File content as Buffer
   * @throws Error if file does not exist
   */
  readFile(relativePath: string): Promise<Buffer>;

  /**
   * Read a file and return as Base64 string.
   * @param relativePath - Path relative to data dir
   * @returns Base64-encoded file content
   * @throws Error if file does not exist
   */
  readFileAsBase64(relativePath: string): Promise<string>;

  /**
   * Check if a file exists.
   * @param relativePath - Path relative to data dir
   * @returns true if file exists
   */
  fileExists(relativePath: string): Promise<boolean>;

  /**
   * Delete a file from storage.
   * @param relativePath - Path relative to data dir
   * @throws Error if file does not exist
   */
  deleteFile(relativePath: string): Promise<void>;

  /**
   * List filenames in a directory.
   * @param relativeDirPath - Directory path relative to data dir
   * @returns Array of filenames (not full paths)
   */
  listFiles(relativeDirPath: string): Promise<string[]>;

  /**
   * Ensure a directory exists, creating it and any parent directories if needed.
   * @param relativeDirPath - Directory path relative to data dir
   */
  ensureDir(relativeDirPath: string): Promise<void>;
}
