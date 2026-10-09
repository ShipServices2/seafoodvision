// Licence certificate configuration.

/**
 * Name of the licensor printed on every licence certificate.
 * TODO before going live: replace with the legal name of the company that grants the licences
 * (or set LICENSOR_NAME in the environment).
 */
export const LICENSOR_NAME: string = process.env.LICENSOR_NAME?.trim() || 'SeafoodVision';

/** Private bucket holding the generated certificates (created on first use, PDF only, never public). */
export const LICENSE_DOCUMENTS_BUCKET = 'license-documents';
