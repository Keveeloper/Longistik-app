// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')
// Trip tracking (request/seguimiento-viaje.md): drivers load their active trip on Inicio and the
// manifiesto detail loads its tracking card. Specs that don't test it get "no trip"; an unstubbed
// call would reach the real STAGING backend with a fake token, get a 401 and end the session.
// Intercepts defined later in a spec take precedence over these.
beforeEach(() => {
  cy.intercept('GET', '**/mobile/viajes/activo', { body: { viaje: null } });
  cy.intercept('GET', '**/mobile/manifiestos/*/viaje', {
    body: {
      viaje: null,
      esConductor: false,
      puedeIniciar: false,
      motivoNoDisponible: 'Solo el conductor asignado al vehículo puede iniciar el seguimiento.',
      consentimientoVigente: false,
      versionConsentimiento: '2026-11-v1',
    },
  });
});
