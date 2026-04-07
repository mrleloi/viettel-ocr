/**
 * Validation rule constants.
 */

/** Maximum file size for a single PDF upload (50 MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum number of files per batch upload */
export const MAX_FILES_PER_BATCH = 100;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = ['.pdf', '.zip'] as const;

/** Maximum invoice age in months for warning */
export const INVOICE_AGE_WARNING_MONTHS = 6;

/** Minimum confidence for auto-mapping */
export const MIN_AUTO_MAPPING_CONFIDENCE = 0.85;

/** Minimum confidence for fuzzy match suggestion */
export const MIN_FUZZY_MATCH_CONFIDENCE = 0.50;

/** Maximum number of fuzzy match suggestions */
export const MAX_FUZZY_SUGGESTIONS = 5;

/** Tax ID (MST) regex pattern for Vietnam */
export const VIETNAM_TAX_ID_PATTERN = /^\d{10}(-\d{3})?$/;

/** Invoice number max length */
export const INVOICE_NUMBER_MAX_LENGTH = 50;
