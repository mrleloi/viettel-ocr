import type { IBatchRepository } from '../../domain/batch/batch.repository';
import type { IInvoiceRepository } from '../../domain/invoice/invoice.repository';
import type { IFileStorage } from '../../domain/shared/file-storage';
import type { IJobQueue } from '../../domain/shared/job-queue';
import { Batch } from '../../domain/batch/batch.entity';
import { Invoice } from '../../domain/invoice/invoice.entity';
import { createHash } from 'crypto';
import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CreateNotificationUseCase } from '../notification/create-notification.use-case';

/** Input for a single file in the upload */
export interface UploadFileInput {
  /** Original filename */
  readonly filename: string;
  /** File content as Buffer */
  readonly content: Buffer;
  /** MIME type */
  readonly mimeType: string;
}

/** Duplicate handling policy */
export type DuplicatePolicy = 'skip' | 'process_anyway' | 'flag_only';

/** Input for the upload batch use case */
export interface UploadBatchInput {
  /** Files to upload */
  readonly files: ReadonlyArray<UploadFileInput>;
  /** Upload mode: 'single_ncc' or 'mixed' */
  readonly uploadMode: string;
  /** Optional schema hint (NCC selection) */
  readonly hintSchemaId?: string | null;
  /** Duplicate handling policy (default: 'skip') */
  readonly onDuplicate?: DuplicatePolicy;
  /** Whether to auto-create schema for new invoice patterns */
  readonly autoCreateSchemaOnNewPattern?: boolean;
}

/** Result for a single file */
export interface UploadFileResult {
  /** Original filename */
  readonly filename: string;
  /** Processing status */
  readonly status: 'accepted' | 'rejected' | 'duplicate';
  /** Invoice ID (if accepted or duplicate) */
  readonly invoiceId?: string;
  /** Rejection reason (if rejected) */
  readonly reason?: string;
  /** ID of the original invoice (if duplicate) */
  readonly duplicateOfId?: string;
}

/** Output of the upload batch use case */
export interface UploadBatchOutput {
  /** Created batch ID */
  readonly batchId: string;
  /** Total files in batch */
  readonly totalFiles: number;
  /** Number of accepted files */
  readonly acceptedFiles: number;
  /** Number of rejected files */
  readonly rejectedFiles: number;
  /** Number of duplicate files */
  readonly duplicateFiles: number;
  /** Per-file results */
  readonly results: ReadonlyArray<UploadFileResult>;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * UploadBatchUseCase — orchestrates file upload flow.
 *
 * 1. Creates a Batch entity
 * 2. For each file: validates, hashes, dedup checks, saves, creates Invoice
 * 3. Persists batch and invoices
 * 4. Enqueues non-duplicate invoices for processing
 */
@Injectable()
export class UploadBatchUseCase {
  private readonly logger = new Logger(UploadBatchUseCase.name);

  constructor(
    @Inject('IBatchRepository') private readonly batchRepo: IBatchRepository,
    @Inject('IInvoiceRepository') private readonly invoiceRepo: IInvoiceRepository,
    @Inject('IFileStorage') private readonly fileStorage: IFileStorage,
    @Inject('IJobQueue') private readonly jobQueue: IJobQueue,
    @Optional() private readonly createNotification?: CreateNotificationUseCase,
  ) {}

  /**
   * Execute the upload batch flow.
   * @param input - Upload parameters including files and classification hint
   * @returns Batch creation result with per-file status
   */
  async execute(input: UploadBatchInput): Promise<UploadBatchOutput> {
    const results: UploadFileResult[] = [];
    const invoicesToSave: Invoice[] = [];
    const invoiceIdsToEnqueue: string[] = [];

    // Count valid files for batch creation
    let acceptedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    // Pre-scan to get total valid files for batch entity
    const fileValidations = input.files.map(f => this.validateFile(f));
    const totalValidFiles = fileValidations.filter(v => v.valid).length;

    // Create batch (need at least 1 valid file to set totalFiles,
    // or we create with total=files.length as the raw count)
    const batch = Batch.create({
      uploadMode: input.uploadMode,
      totalFiles: Math.max(totalValidFiles, 1),
      hintSchemaId: input.hintSchemaId ?? null,
      autoCreateSchemaOnNewPattern: input.autoCreateSchemaOnNewPattern ?? false,
    });

    // Process each file
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const validation = fileValidations[i];

      if (!validation.valid) {
        rejectedCount++;
        results.push({
          filename: file.filename,
          status: 'rejected',
          reason: validation.reason,
        });
        continue;
      }

      // Compute file hash
      const fileHash = this.computeHash(file.content);

      // Check for duplicate
      const existingInvoice = await this.invoiceRepo.findByFileHash(fileHash);
      if (existingInvoice) {
        const policy = input.onDuplicate ?? 'skip';

        if (policy === 'process_anyway') {
          // Re-enqueue existing invoice for reprocessing
          existingInvoice.resumeForReprocess();
          invoicesToSave.push(existingInvoice);
          invoiceIdsToEnqueue.push(existingInvoice.id);
          acceptedCount++;
          results.push({
            filename: file.filename,
            status: 'accepted',
            invoiceId: existingInvoice.id,
            duplicateOfId: existingInvoice.id,
          });
          continue;
        }

        // 'skip' or 'flag_only' — create duplicate invoice record
        duplicateCount++;
        const invoice = Invoice.create({
          batchId: batch.id,
          originalFilename: file.filename,
          storagePath: `uploads/${batch.id}/${file.filename}`,
          fileHash,
          fileSizeBytes: file.content.length,
          pageCount: 1,
        });
        invoice.markAsDuplicate(existingInvoice.id);
        invoicesToSave.push(invoice);
        results.push({
          filename: file.filename,
          status: 'duplicate',
          invoiceId: invoice.id,
          duplicateOfId: existingInvoice.id,
        });

        // Emit notification for duplicate detection
        try {
          await this.createNotification?.execute({
            category: 'duplicate_detected',
            title: 'Phát hiện file trùng lặp',
            message: `File "${file.filename}" trùng với hóa đơn đã có trong hệ thống.`,
            relatedEntityType: 'invoice',
            relatedEntityId: invoice.id,
          });
        } catch (err) {
          this.logger.warn('Failed to create duplicate notification', err);
        }

        continue;
      }

      // Save file to storage
      const storagePath = `uploads/${batch.id}/${file.filename}`;
      await this.fileStorage.saveFile(storagePath, file.content);

      // Create invoice
      const invoice = Invoice.create({
        batchId: batch.id,
        originalFilename: file.filename,
        storagePath,
        fileHash,
        fileSizeBytes: file.content.length,
        pageCount: 1,
      });

      acceptedCount++;
      invoicesToSave.push(invoice);
      invoiceIdsToEnqueue.push(invoice.id);
      results.push({
        filename: file.filename,
        status: 'accepted',
        invoiceId: invoice.id,
      });
    }

    // Save batch
    await this.batchRepo.save(batch);

    // Save all invoices
    for (const invoice of invoicesToSave) {
      await this.invoiceRepo.save(invoice);
    }

    // Transition batch to processing (only if we have accepted files)
    if (acceptedCount > 0) {
      batch.startProcessing();
      await this.batchRepo.save(batch);
    }

    // Enqueue accepted invoices for processing
    for (const invoiceId of invoiceIdsToEnqueue) {
      await this.jobQueue.enqueue(invoiceId);
    }

    return {
      batchId: batch.id,
      totalFiles: input.files.length,
      acceptedFiles: acceptedCount,
      rejectedFiles: rejectedCount,
      duplicateFiles: duplicateCount,
      results,
    };
  }

  /**
   * Validate an uploaded file.
   * @param file - File to validate
   * @returns Validation result
   */
  private validateFile(file: UploadFileInput): { valid: boolean; reason?: string } {
    if (file.mimeType !== 'application/pdf') {
      return { valid: false, reason: `Not a PDF file: ${file.mimeType}` };
    }
    if (file.content.length > MAX_FILE_SIZE_BYTES) {
      return { valid: false, reason: `File too large: ${(file.content.length / 1024 / 1024).toFixed(1)}MB (max 20MB)` };
    }
    if (file.content.length === 0) {
      return { valid: false, reason: 'File is empty' };
    }
    return { valid: true };
  }

  /**
   * Compute SHA-256 hash of file content.
   * @param content - File content buffer
   * @returns Hex-encoded hash string
   */
  private computeHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
