/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Picks STAGING and logs in through the UI with stubbed endpoints, then waits for Inicio. */
      login(): Chainable<void>;
    }
  }
}

const despachador = {
  id: 34,
  name: 'Andrés',
  lastName: 'Rojas',
  email: 'andres@longistik.com',
  role: 'Despachador',
  alcance: 'todos',
  permisos: ['app.acceso', 'manifiestos.ver_todos', 'remesas.cumplir', 'novedades.reportar'],
  vehiculos: [],
};

Cypress.Commands.add('login', () => {
  // Unstubbed calls would reach the real STAGING backend with a fake token, get a 401 and end the session
  const empty = { items: [], page: 1, pageSize: 20, total: 0 };
  cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' });
  cy.intercept('POST', '**/mobile/auth/login', {
    statusCode: 201,
    body: { accessToken: 'test.jwt.token', expiresIn: 2592000, user: despachador },
  });
  cy.intercept('GET', '**/mobile/me', { body: { ...despachador, status: true } });
  cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
  cy.intercept('GET', '**/mobile/manifiestos?*', { body: empty });
  cy.intercept('GET', '**/mobile/remesas?*', { body: empty });

  cy.visit('/');
  cy.contains('ion-item', 'STAGING').click();
  cy.get('input[autocomplete="username"]').type(despachador.email);
  cy.get('input[type="password"]').type('secret');
  cy.contains('ion-button', 'Ingresar').click();
  cy.contains('h1', 'Hola, Andrés').should('be.visible');
});

export {};
