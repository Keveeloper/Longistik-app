import { isCompanyAllowed } from './env';

describe('isCompanyAllowed', () => {
  test('test builds only allow the test companies', () => {
    expect(isCompanyAllowed('finaltest', 'test')).toBe(true);
    expect(isCompanyAllowed('servicargas360', 'test')).toBe(false);
  });

  test('production hides the test companies', () => {
    expect(isCompanyAllowed('finaltest', 'production')).toBe(false);
    expect(isCompanyAllowed('servicargas360', 'production')).toBe(true);
  });
});
