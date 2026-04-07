import { DomainError } from '../domain-error';

describe('DomainError', () => {
  it('should create error with message', () => {
    const error = new DomainError('Something went wrong');
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('DomainError');
  });

  it('should be an instance of Error', () => {
    const error = new DomainError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('should preserve stack trace', () => {
    const error = new DomainError('test');
    expect(error.stack).toBeDefined();
  });
});
