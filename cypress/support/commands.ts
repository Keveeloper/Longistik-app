/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Logs in through the login screen with the mock service and waits for Inicio. */
      login(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', () => {
  cy.visit('/login');
  cy.get('input[autocomplete="username"]').type('andres.rojas@transvalle.co');
  cy.get('input[type="password"]').type('secret');
  cy.contains('ion-button', 'Ingresar').click();
  cy.contains('h1', 'Hola, Andrés').should('be.visible');
});

export {};
