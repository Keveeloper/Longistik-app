describe('Novedades (mock data)', () => {
  // Scope to the Novedades page: Ionic keeps other visited pages mounted
  const novedadesPage = () => cy.contains('h1', 'Novedades').closest('.ion-page');
  const cards = () => novedadesPage().find('.novedades-item');

  beforeEach(() => {
    cy.login();
    cy.get('ion-tab-button[tab="novedades"]').click();
    cy.location('pathname').should('eq', '/novedades');
    cy.contains('h1', 'Novedades').should('be.visible');
  });

  it('shows the open novedades with their summary', () => {
    novedadesPage().contains('2 abiertas').should('be.visible');
    novedadesPage().contains('En 2 manifiestos activos hoy').should('be.visible');
    cards().should('have.length', 2);
    cards()
      .first()
      .should('contain', 'Bloqueo vial')
      .and('contain', 'Hace 25 min')
      .and('contain', 'MT000661 · Villa Rica → Cali')
      .and('contain', '1 foto · ubicación');
    cards().first().find('ion-badge').should('have.text', 'Abierta');
    cards().eq(1).should('contain', 'Hace 2 h').and('contain', 'Asignada a Despachos');
    cards().eq(1).find('ion-badge').should('have.text', 'En gestión');
  });

  it('switches to the closed novedades with the segment', () => {
    novedadesPage().contains('ion-segment-button', 'Cerradas').click();
    novedadesPage().contains('2 cerradas').should('be.visible');
    novedadesPage().contains('En los últimos 7 días').should('be.visible');
    cards().should('have.length', 2).each(($c) => expect($c.find('ion-badge').text()).to.eq('Cerrada'));
    cards().first().should('contain', 'Hace 1 d').and('contain', 'Resuelta por Despachos');

    novedadesPage().contains('ion-segment-button', 'Abiertas').click();
    novedadesPage().contains('2 abiertas').should('be.visible');
  });
});
