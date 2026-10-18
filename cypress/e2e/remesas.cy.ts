describe('Remesas (mock data)', () => {
  // Scope to the Remesas page: Ionic keeps other visited pages (e.g. Inicio) mounted
  const remesasPage = () => cy.contains('h1', 'Remesas').closest('.ion-page');
  const rows = () => remesasPage().find('.remesas-item');
  const search = (text: string) => remesasPage().find('.app-search input').clear().type(text);

  beforeEach(() => {
    cy.login();
    cy.get('ion-tab-button[tab="remesas"]').click();
    cy.location('pathname').should('eq', '/remesas');
    cy.contains('h1', 'Remesas').should('be.visible');
  });

  it('groups remesas by day, newest first, with "Hoy" for today', () => {
    remesasPage().find('.remesas-day').should('have.length', 3);
    remesasPage().find('.remesas-day').first().invoke('text').should('match', /^Hoy · \w{3} \d{1,2}$/);
    remesasPage().find('.remesas-day').eq(1).invoke('text').should('not.contain', 'Hoy');
    rows().should('have.length', 9);
    rows().first().should('contain', 'RM0001956').and('contain', 'Cumplido RNDC 141883793').and('contain', 'Cumplido');
  });

  it('shows the pending-RNDC callout', () => {
    remesasPage().contains('p', '3 remesas pendientes por enviar al RNDC').should('be.visible');
    remesasPage().contains('ion-button', 'Enviar').click();
    cy.get('ion-toast').should('have.prop', 'message', 'Disponible próximamente');
  });

  it('filters by estado, including the partly hidden chip', () => {
    remesasPage().contains('ion-chip', 'Creadas').click();
    rows().should('have.length', 3).each(($r) => expect($r.find('ion-badge').text()).to.eq('Creada'));
    remesasPage().contains('ion-chip', 'En ruta').click();
    rows().should('have.length', 2);
    // "Cumplidas" overflows the row; it scrolls into view to be tapped
    remesasPage().contains('ion-chip', 'Cumplidas').scrollIntoView().click();
    rows().should('have.length', 3).each(($r) => expect($r.find('ion-badge').text()).to.eq('Cumplido'));
    remesasPage().contains('ion-chip', 'Todas').click();
    rows().should('have.length', 9);
  });

  it('searches by number, client (ignoring accents) and NIT', () => {
    search('1955');
    rows().should('have.length', 1).and('contain', 'RM0001955');
    search('ferreteria');
    rows().should('have.length', 2);
    search('805012345');
    rows().should('have.length', 2).and('contain', 'Agrocomercial del Valle');
    search('xyz');
    rows().should('have.length', 0);
    cy.contains('No hay remesas que coincidan').should('be.visible');
  });
});
