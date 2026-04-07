import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalFileStorage } from '../local-storage.service';

describe('LocalFileStorage', () => {
  let storage: LocalFileStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory per test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viettel-test-'));
    const mockConfig = { dataDir: tempDir };
    storage = new LocalFileStorage(mockConfig as never);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('saveFile', () => {
    it('should create file and parent directories', async () => {
      const content = Buffer.from('PDF content here');
      await storage.saveFile('uploads/batch-1/invoice.pdf', content);

      const filePath = path.join(tempDir, 'uploads', 'batch-1', 'invoice.pdf');
      const actual = await fs.readFile(filePath);
      expect(actual).toEqual(content);
    });

    it('should overwrite existing file', async () => {
      const content1 = Buffer.from('Version 1');
      const content2 = Buffer.from('Version 2');

      await storage.saveFile('test.txt', content1);
      await storage.saveFile('test.txt', content2);

      const actual = await fs.readFile(path.join(tempDir, 'test.txt'));
      expect(actual).toEqual(content2);
    });
  });

  describe('readFile', () => {
    it('should return file content as Buffer', async () => {
      const content = Buffer.from('Hello World');
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, content);

      const result = await storage.readFile('test.txt');
      expect(result).toEqual(content);
    });

    it('should throw on non-existent file', async () => {
      await expect(storage.readFile('does-not-exist.txt')).rejects.toThrow();
    });
  });

  describe('readFileAsBase64', () => {
    it('should return Base64-encoded content', async () => {
      const content = Buffer.from('PDF binary data');
      await fs.writeFile(path.join(tempDir, 'test.pdf'), content);

      const result = await storage.readFileAsBase64('test.pdf');
      expect(result).toBe(content.toString('base64'));
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await fs.writeFile(path.join(tempDir, 'exists.txt'), 'data');
      expect(await storage.fileExists('exists.txt')).toBe(true);
    });

    it('should return false for missing file', async () => {
      expect(await storage.fileExists('nope.txt')).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should remove file', async () => {
      const filePath = path.join(tempDir, 'to-delete.txt');
      await fs.writeFile(filePath, 'delete me');

      await storage.deleteFile('to-delete.txt');

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should throw on non-existent file', async () => {
      await expect(storage.deleteFile('nope.txt')).rejects.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should return filenames in directory', async () => {
      const dir = path.join(tempDir, 'listdir');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'a.txt'), 'a');
      await fs.writeFile(path.join(dir, 'b.pdf'), 'b');

      const result = await storage.listFiles('listdir');
      expect(result.sort()).toEqual(['a.txt', 'b.pdf']);
    });

    it('should return empty array for empty directory', async () => {
      const dir = path.join(tempDir, 'emptydir');
      await fs.mkdir(dir, { recursive: true });

      const result = await storage.listFiles('emptydir');
      expect(result).toEqual([]);
    });
  });

  describe('ensureDir', () => {
    it('should create nested directory structure', async () => {
      await storage.ensureDir('uploads/2026/04/07');

      const dirPath = path.join(tempDir, 'uploads', '2026', '04', '07');
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await storage.ensureDir('existing');
      await expect(storage.ensureDir('existing')).resolves.not.toThrow();
    });
  });

  describe('path traversal protection', () => {
    it('should reject paths containing ..', async () => {
      await expect(
        storage.saveFile('../../../etc/passwd', Buffer.from('hack')),
      ).rejects.toThrow(/path traversal/i);
    });

    it('should reject readFile with ..', async () => {
      await expect(
        storage.readFile('../../secret.txt'),
      ).rejects.toThrow(/path traversal/i);
    });
  });
});
