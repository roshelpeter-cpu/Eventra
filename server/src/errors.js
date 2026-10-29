export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isUniqueConstraint(error) {
  return error?.errcode === 2067 || /UNIQUE constraint failed/i.test(error?.message || '');
}

export function isCapacityConstraint(error) {
  return error?.errcode === 1811 || /capacity_exceeded/i.test(error?.message || '');
}

export function isForeignKeyConstraint(error) {
  return error?.errcode === 787 || /FOREIGN KEY constraint failed/i.test(error?.message || '');
}
