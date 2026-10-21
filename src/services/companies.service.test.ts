import { matchesCompany, type Company } from './companies.service';

const company: Company = {
  code: 'cargandina',
  name: 'Carga Andina Logística S.A.S.',
  apiUrl: 'https://api.cargandina.longistik.com',
  webUrl: 'https://cargandina.longistik.com',
};

describe('matchesCompany', () => {
  test('matches name or code ignoring case and accents', () => {
    expect(matchesCompany(company, 'LOGISTICA')).toBe(true);
    expect(matchesCompany(company, 'cargand')).toBe(true);
    expect(matchesCompany(company, 'zzz')).toBe(false);
  });

  test('an empty query matches everything', () => {
    expect(matchesCompany(company, '  ')).toBe(true);
  });
});
