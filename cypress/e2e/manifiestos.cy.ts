describe('Manifiestos (mock data)', () => {
  // Scope to the Manifiestos page: Ionic keeps other visited pages mounted
  const manifiestosPage = () => cy.contains('h1', 'Manifiestos').closest('.ion-page');
  const rows = () => manifiestosPage().find('.manifiestos-item');

  beforeEach(() => {
    cy.login();
    cy.get('ion-tab-button[tab="manifiestos"]').click();
    cy.location('pathname').should('eq', '/manifiestos');
    cy.contains('h1', 'Manifiestos').should('be.visible');
  });

  const search = (text: string) => manifiestosPage().find('.app-search input').clear().type(text);

  it('lists the manifiestos with their count', () => {
    rows().should('have.length', 10);
    cy.contains('10 manifiestos · últimos 7 días').should('be.visible');
    rows().first().should('contain', 'MT000662').and('contain', '$800.000').and('contain', 'Ago 22');
  });

  it('filters by estado with the chips', () => {
    manifiestosPage().contains('ion-chip', 'Activos').click().should('have.attr', 'aria-pressed', 'true');
    rows().should('have.length', 4).each(($row) => expect($row.find('ion-badge').text()).to.eq('Activo'));
    manifiestosPage().contains('ion-chip', 'Inactivos').click();
    rows().should('have.length', 6).each(($row) => expect($row.find('ion-badge').text()).to.eq('Inactivo'));
    manifiestosPage().contains('ion-chip', 'Todos').click();
    rows().should('have.length', 10);
  });

  it('searches by number, route (ignoring accents) and plate', () => {
    search('000657');
    rows().should('have.length', 1).and('contain', 'MT000657');
    search('jamundi');
    rows().should('have.length', 1).and('contain', 'Jamundí');
    search('krd330');
    rows().should('have.length', 2);
    search('bogota');
    rows().should('have.length', 0);
    cy.contains('No hay manifiestos que coincidan').should('be.visible');
  });

  it('combines search and estado filter', () => {
    search('villa rica');
    manifiestosPage().contains('ion-chip', 'Activos').click();
    rows().should('have.length', 2);
    cy.contains('2 manifiestos · últimos 7 días').should('be.visible');
  });
});
