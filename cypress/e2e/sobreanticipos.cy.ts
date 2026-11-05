// Sobreanticipos (request/app-movil-sobreanticipos.md): request one from the manifiesto's detail,
// see it in "Mis sobreanticipos" and cancel it. Every request is stubbed.

const conductor = {
  id: 34,
  name: 'Andrés',
  lastName: 'Rojas',
  email: 'andres@longistik.com',
  role: 'Conductor',
  alcance: 'asignados',
  permisos: ['app.acceso', 'manifiestos.ver_asignados', 'remesas.cumplir', 'novedades.reportar', 'sobreanticipos.solicitar'],
  vehiculos: [{ id: 12, placa: 'ABC123', desde: '2026-10-21T00:00:00-05:00', hasta: null }],
};

const cali = { codigoDane: '76001000', nombre: 'Cali, Valle del Cauca' };
const bogota = { codigoDane: '11001000', nombre: 'Bogotá, D.C.' };

const manifiesto = {
  id: 812,
  numero: 'MT000812',
  consecutivoRndc: '123456789',
  fechaExpedicion: '2026-10-20T07:10:00-05:00',
  estado: 'activo',
  estadoRndc: 'reportado',
  vehiculoId: 12,
  placa: 'ABC123',
  conductor: { id: 7, nombre: 'Andrés Rojas' },
  origen: cali,
  destino: bogota,
  remesas: 0,
  valorFlete: 3200000,
};

const motivos = [
  { codigo: 'varada', nombre: 'Varada', requiereDescripcion: false },
  { codigo: 'peajes', nombre: 'Peajes', requiereDescripcion: false },
  { codigo: 'otro', nombre: 'Otro', requiereDescripcion: true },
];

const solicitud = {
  id: 7,
  manifiestoId: 812,
  manifiesto: 'MT000812',
  placa: 'ABC123',
  valor: 350000,
  valorAprobado: null,
  pagado: 0,
  motivo: 'varada',
  motivoNombre: 'Varada',
  descripcion: null,
  soporteUrl: null,
  origen: 'app',
  estado: 'solicitada',
  fechaSolicitud: '2026-10-28T08:12:00-05:00',
  fechaDecision: null,
  notas: null,
  alertaTope: null,
};

const seccion = (items: object[], extra: object = {}) => ({
  manifiestoId: 812,
  disponible: 1122500,
  puedeSolicitar: true,
  motivoNoDisponible: null,
  items,
  ...extra,
});

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length });

describe('Sobreanticipos', () => {
  const login = (user: object = conductor) => {
    cy.intercept('POST', '**/mobile/auth/login', { statusCode: 201, body: { accessToken: 't', expiresIn: 2592000, user } });
    cy.intercept('GET', '**/mobile/me', { body: { ...user, status: true } });
    cy.visit('/');
    cy.contains('ion-item', 'STAGING').click();
    cy.get('input[autocomplete="username"]').type('andres@longistik.com');
    cy.get('input[type="password"]').type('secret');
    cy.contains('ion-button', 'Ingresar').click();
    cy.contains('h1', 'Hola, Andrés').should('be.visible');
  };

  const visiblePage = () => cy.get('.ion-page:not(.ion-page-hidden)').last();

  const abrirManifiesto = () => {
    cy.get('ion-tab-button[tab="manifiestos"]').click();
    cy.contains('MT000812').should('be.visible').click();
    cy.location('pathname').should('eq', '/manifiestos/812');
  };

  beforeEach(() => {
    cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' });
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
    cy.intercept('GET', '**/mobile/manifiestos?*', { body: page([manifiesto]) });
    cy.intercept('GET', '**/mobile/manifiestos/812', { body: { ...manifiesto, remesas: [], novedades: [], rndcError: null } });
    cy.intercept('GET', '**/mobile/manifiestos/812/pdf', { statusCode: 500, body: {} });
    cy.intercept('GET', '**/mobile/remesas?*', { body: page([]) });
    cy.intercept('GET', '**/mobile/catalogos/motivos-sobreanticipo', { body: motivos }).as('motivos');
  });

  it('requests a sobreanticipo from the manifiesto and validates the form', () => {
    let creada = false;
    cy.intercept('GET', '**/mobile/manifiestos/812/sobreanticipos', (req) =>
      req.reply({ body: seccion(creada ? [solicitud] : []) })
    ).as('seccion');
    const bodies: object[] = [];
    cy.intercept('POST', '**/mobile/manifiestos/812/sobreanticipos', (req) => {
      bodies.push(req.body);
      if (req.body.valor > 1122500) {
        req.reply({
          statusCode: 409,
          body: { statusCode: 409, code: 'SALDO_NEGATIVO', message: 'El valor supera el saldo disponible: $1.122.500.' },
        });
        return;
      }
      creada = true;
      req.reply({
        statusCode: 201,
        body: { ...solicitud, mensaje: 'Solicitud de sobreanticipo #7 por $350.000 registrada: queda pendiente de aprobación.' },
      });
    }).as('solicitar');

    login();
    abrirManifiesto();
    cy.wait('@seccion');
    // The section is below the fold
    visiblePage()
      .find('ion-content')
      .then(($c) => ($c[0] as HTMLIonContentElement).scrollToBottom(0));
    visiblePage().contains('No hay solicitudes').should('be.visible');
    visiblePage().contains('Disponible $1.122.500').should('be.visible');
    cy.contains('ion-button', 'Solicitar sobreanticipo').click();
    cy.wait('@motivos');

    // "Otro" needs a description: nothing is sent
    cy.get('ion-modal input[inputmode="numeric"]').type('350000');
    cy.get('ion-modal input[inputmode="numeric"]').should('have.value', '350.000');
    cy.contains('ion-modal button[role="radio"]', 'Otro').click();
    cy.contains('ion-modal ion-button', 'Enviar solicitud').click();
    cy.contains('ion-modal', 'Describe para qué es').should('be.visible');

    // More than what's available: the backend's message, form still open
    cy.contains('ion-modal button[role="radio"]', 'Varada').click();
    cy.get('ion-modal input[inputmode="numeric"]').clear().type('2000000');
    cy.contains('ion-modal ion-button', 'Enviar solicitud').click();
    cy.wait('@solicitar');
    cy.contains('ion-modal [role="alert"]', 'supera el saldo disponible').should('be.visible');

    cy.get('ion-modal input[inputmode="numeric"]').clear().type('350000');
    cy.contains('ion-modal ion-button', 'Enviar solicitud').click();
    cy.wait('@solicitar').then(() => {
      expect(bodies).to.deep.eq([
        { valor: 2000000, motivo: 'varada' },
        { valor: 350000, motivo: 'varada' },
      ]);
    });
    cy.get('ion-toast').shadow().find('.toast-message').should('contain.text', 'queda pendiente de aprobación');
    // An inline modal stays in the DOM, hidden, with its content unmounted
    cy.get('ion-modal').should('have.class', 'overlay-hidden');
    cy.get('ion-modal input').should('not.exist');
    visiblePage().contains('Sobreanticipos · 1').should('be.visible');
    visiblePage().contains('Pendiente de aprobación').should('be.visible');
    visiblePage().contains('$350.000').should('exist');
  });

  it('disables the button with the reason on a fulfilled manifiesto', () => {
    const motivo = 'El manifiesto ya tiene el cumplido: no admite más sobreanticipos.';
    cy.intercept('GET', '**/mobile/manifiestos/812/sobreanticipos', {
      body: seccion([{ ...solicitud, estado: 'pagada', valorAprobado: 300000 }], { puedeSolicitar: false, motivoNoDisponible: motivo }),
    });
    login();
    abrirManifiesto();
    visiblePage().contains(motivo).should('exist');
    visiblePage().contains('ion-button', 'Solicitar sobreanticipo').should('have.attr', 'disabled');
    visiblePage().contains('Pagada').should('exist');
    visiblePage().contains('Aprobado por $300.000').should('exist');
  });

  it('lists my requests, filters them and cancels a pending one', () => {
    let estado = 'solicitada';
    const aprobada = { ...solicitud, id: 8, valor: 400000, valorAprobado: 300000, estado: 'aprobada', motivoNombre: 'Peajes' };
    cy.intercept('GET', '**/mobile/sobreanticipos?*', (req) => {
      const items = [{ ...solicitud, estado }, aprobada];
      req.reply({ body: page(req.query.estado ? items.filter((i) => i.estado === req.query.estado) : items) });
    }).as('mias');
    cy.intercept('POST', '**/mobile/sobreanticipos/7/cancelar', (req) => {
      expect(req.body).to.deep.eq({ notas: 'Ya no se necesita' });
      estado = 'cancelada';
      req.reply({ body: { ...solicitud, estado: 'cancelada', mensaje: 'Solicitud #7 cancelada.' } });
    }).as('cancelar');
    cy.intercept('GET', '**/mobile/manifiestos/812/sobreanticipos', { body: seccion([solicitud]) });

    login();
    cy.contains('ion-item', 'Mis sobreanticipos').click();
    cy.location('pathname').should('eq', '/sobreanticipos');
    cy.wait('@mias');
    visiblePage().contains('2 solicitudes').should('be.visible');
    visiblePage().contains('Aprobada · por pagar').should('be.visible');

    cy.contains('ion-segment-button', 'Aprobadas').click();
    visiblePage().contains('1 solicitud').should('be.visible');
    cy.contains('ion-segment-button', 'Todas').click();
    visiblePage().contains('2 solicitudes').should('be.visible');

    visiblePage().contains('button', 'Cancelar solicitud').first().click();
    // Ionic focuses the alert once it finished opening, which steals the focus from an input typed into earlier
    cy.focused().should('match', 'ion-alert .alert-wrapper');
    cy.get('ion-alert textarea').type('Ya no se necesita');
    cy.get('ion-alert textarea').should('have.value', 'Ya no se necesita');
    cy.contains('ion-alert button', 'Cancelar solicitud').click();
    cy.wait('@cancelar');
    cy.get('ion-toast').shadow().find('.toast-message').should('contain.text', 'cancelada');
    visiblePage().contains('Cancelada').should('be.visible');

    // A row opens its manifiesto at the sobreanticipos section
    visiblePage().contains('button', 'Peajes').click();
    cy.location('pathname').should('eq', '/manifiestos/812');
    cy.location('search').should('eq', '?seccion=sobreanticipos');
    visiblePage().contains('h2', 'Sobreanticipos').should('be.visible');
  });

  it('hides everything without the permission', () => {
    cy.intercept('GET', '**/mobile/manifiestos/812/sobreanticipos', cy.spy().as('seccion'));
    login({ ...conductor, permisos: conductor.permisos.filter((p) => p !== 'sobreanticipos.solicitar') });
    cy.contains('ion-item', 'Mis sobreanticipos').should('not.exist');
    abrirManifiesto();
    visiblePage().contains('Datos').should('be.visible');
    visiblePage().contains('Sobreanticipos').should('not.exist');
    cy.get('@seccion').should('not.have.been.called');
  });
});
