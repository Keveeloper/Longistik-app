// Trip tracking and the bell (request/seguimiento-viaje.md, request/notificaciones-push.md):
// start a trip with consent, share the location in one tap (also without signal), ask for help,
// and open notifications. Every request is stubbed; push itself only exists on the phone.

const conductor = {
  id: 34,
  name: 'Andrés',
  lastName: 'Rojas',
  email: 'andres@longistik.com',
  role: 'Conductor',
  alcance: 'asignados',
  permisos: ['app.acceso', 'manifiestos.ver_asignados', 'remesas.cumplir', 'novedades.reportar'],
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

const ahoraIso = () => new Date().toISOString();

const viajeActivo = (cambios: object = {}) => ({
  id: 9,
  manifiestoId: 812,
  manifiesto: 'MT000812',
  placa: 'ABC123',
  conductor: { id: 34, nombre: 'Andrés' },
  estado: 'activo',
  origen: 'conductor',
  asignadoEn: null,
  iniciadoEn: ahoraIso(),
  finalizadoEn: null,
  motivoFin: null,
  pausaMotivo: null,
  intervaloMin: 30,
  ventanaMin: 20,
  tieneRuta: true,
  paradas: [],
  proximoPedido: new Date(Date.now() + 30 * 60_000).toISOString(),
  pedidoAbierto: null,
  // Recent, so opening the app doesn't send an automatic report during the tests
  ultimoReporte: { capturadoEn: ahoraIso(), estado: 'en_ruta', latitud: 4.6, longitud: -74.08, atrasoMin: 0, bateria: 80 },
  alertas: { desvio: false, sinRespuesta: 0, auxilio: null, llegada: null },
  ultimosReportes: [],
  ...cambios,
});

const estado = (viaje: object | null, cambios: object = {}) => ({
  viaje,
  esConductor: true,
  puedeIniciar: !viaje,
  motivoNoDisponible: null,
  consentimientoVigente: false,
  versionConsentimiento: '2026-11-v1',
  ...cambios,
});

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length });

describe('Trip tracking and notifications', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' });
    cy.intercept('POST', '**/mobile/auth/login', { statusCode: 201, body: { accessToken: 't', expiresIn: 2592000, user: conductor } });
    cy.intercept('GET', '**/mobile/me', { body: { ...conductor, status: true } });
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
    cy.intercept('GET', '**/mobile/manifiestos?*', { body: page([manifiesto]) });
    cy.intercept('GET', '**/mobile/manifiestos/812', { body: { ...manifiesto, remesas: [], novedades: [], rndcError: null } });
    cy.intercept('GET', '**/mobile/manifiestos/812/pdf', { statusCode: 500, body: {} });
    cy.intercept('GET', '**/mobile/remesas?*', { body: page([]) });
  });

  const login = (path?: string) => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Phone GPS in Bogotá
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) =>
          ok({ coords: { latitude: 4.6097102, longitude: -74.0817501, accuracy: 12 }, timestamp: Date.now() })
        );
      },
    });
    cy.contains('ion-item', 'STAGING').click();
    cy.get('input[autocomplete="username"]').type('andres@longistik.com');
    cy.get('input[type="password"]').type('secret');
    cy.contains('ion-button', 'Ingresar').click();
    cy.contains('h1', 'Hola, Andrés').should('be.visible');
    if (path) {
      cy.get('ion-tab-button[tab="manifiestos"]').click();
      cy.contains('MT000812').should('be.visible').click();
      cy.location('pathname').should('eq', path);
    }
  };

  const visiblePage = () => cy.get('.ion-page:not(.ion-page-hidden)').last();

  it('starts the trip after accepting the consent, with the first location', () => {
    let iniciado = false;
    cy.intercept('GET', '**/mobile/manifiestos/812/viaje', (req) => req.reply({ body: iniciado ? estado(viajeActivo(), { consentimientoVigente: true }) : estado(null) })).as('estado');
    cy.intercept('POST', '**/mobile/seguimiento/consentimiento', { statusCode: 201, body: { version: '2026-11-v1' } }).as('consentimiento');
    cy.intercept('POST', '**/mobile/manifiestos/812/viaje/iniciar', (req) => {
      iniciado = true;
      req.reply({ statusCode: 201, body: viajeActivo() });
    }).as('iniciar');

    login('/manifiestos/812');
    cy.wait('@estado');
    visiblePage().contains('Activa el seguimiento').should('be.visible');
    visiblePage().contains('ion-button', 'Iniciar viaje').click();

    // First time: the purpose text (Ley 1581) before anything is shared
    cy.contains('ion-modal', 'Para qué:').should('be.visible');
    cy.contains('ion-modal', 'Nunca en segundo plano').should('be.visible');
    cy.contains('ion-modal ion-button', 'Aceptar e iniciar').click();
    cy.wait('@consentimiento').its('request.body.version').should('eq', '2026-11-v1');
    cy.wait('@iniciar').its('request.body.reporte').should((r) => {
      expect(r.latitud).to.be.closeTo(4.6097, 0.0001);
      expect(r.precisionMetros).to.eq(12);
      expect(r.idempotencyKey).to.be.a('string');
    });
    cy.get('ion-toast').shadow().find('.toast-message').should('contain.text', 'Viaje iniciado');
    visiblePage().contains('Viaje en curso').should('be.visible');
    visiblePage().contains('ion-button', 'Compartir ubicación').should('be.visible');
    visiblePage().contains('ion-button', 'Necesito ayuda').should('be.visible');
  });

  it('shares the location in one tap from the request, and queues it without signal', () => {
    cy.intercept('GET', '**/mobile/viajes/activo', { body: { viaje: viajeActivo({ pedidoAbierto: { id: 55, venceEn: ahoraIso() } }) } });
    cy.intercept('GET', '**/mobile/manifiestos/812/viaje', {
      body: estado(viajeActivo({ pedidoAbierto: { id: 55, venceEn: ahoraIso() } }), { puedeIniciar: false, consentimientoVigente: true }),
    });
    cy.intercept('POST', '**/mobile/viajes/reportes', { forceNetworkError: true }).as('sinSenal');

    login();
    visiblePage().contains('Viaje MT000812 en curso').should('be.visible');
    visiblePage().contains('Tu empresa pidió tu ubicación').should('be.visible');

    // What the "¿Todo bien en tu viaje?" notification opens
    cy.window().then((win) => win.history.pushState({}, '', '/seguimiento/812/compartir'));
    cy.window().then((win) => win.dispatchEvent(new PopStateEvent('popstate')));
    cy.wait('@sinSenal');
    visiblePage().contains('Guardada sin señal').should('be.visible');

    // Signal is back: the queued report goes out with the same key when the app resumes
    let enviado: any[] = [];
    cy.intercept('POST', '**/mobile/viajes/reportes', (req) => {
      enviado = req.body;
      req.reply({ body: { resultados: req.body.map((r: any) => ({ idempotencyKey: r.idempotencyKey, estado: 'aceptado' })) } });
    }).as('reportes');
    cy.document().then((doc) => doc.dispatchEvent(new Event('visibilitychange')));
    cy.wait('@reportes').then(() => {
      expect(enviado).to.have.length(1);
      expect(enviado[0]).to.include({ viajeId: 9, pedidoId: 55, tipo: 'pedido' });
    });

    // Answering again, with signal
    visiblePage().contains('ion-button', 'Volver').click();
    cy.window().then((win) => win.history.pushState({}, '', '/seguimiento/812/compartir'));
    cy.window().then((win) => win.dispatchEvent(new PopStateEvent('popstate')));
    cy.wait('@reportes');
    visiblePage().contains('Listo, gracias').should('be.visible');
  });

  it('asks for help with the location and offers to call 123', () => {
    cy.intercept('GET', '**/mobile/manifiestos/812/viaje', { body: estado(viajeActivo(), { puedeIniciar: false, consentimientoVigente: true }) });
    let tipo = '';
    cy.intercept('POST', '**/mobile/viajes/reportes', (req) => {
      tipo = req.body[0].tipo;
      req.reply({ body: { resultados: [{ idempotencyKey: req.body[0].idempotencyKey, estado: 'aceptado' }] } });
    }).as('reportes');

    login('/manifiestos/812');
    visiblePage().contains('ion-button', 'Necesito ayuda').click();
    cy.focused().should('match', 'ion-alert .alert-wrapper');
    cy.contains('ion-alert button', 'Enviar alerta').click();
    cy.wait('@reportes').then(() => expect(tipo).to.eq('auxilio'));
    cy.contains('ion-alert', 'Alerta enviada').should('be.visible');
    cy.contains('ion-alert button', 'Llamar al 123').should('be.visible');
  });

  it('pauses and resumes the trip', () => {
    let pausado = false;
    cy.intercept('GET', '**/mobile/manifiestos/812/viaje', (req) =>
      req.reply({ body: estado(viajeActivo(pausado ? { estado: 'pausado', pausaMotivo: 'Almuerzo' } : {}), { puedeIniciar: false, consentimientoVigente: true }) })
    );
    cy.intercept('POST', '**/mobile/viajes/9/pausar', (req) => {
      expect(req.body).to.deep.eq({ motivo: 'Almuerzo' });
      pausado = true;
      req.reply({ body: viajeActivo({ estado: 'pausado' }) });
    }).as('pausar');
    cy.intercept('POST', '**/mobile/viajes/9/reanudar', (req) => {
      pausado = false;
      req.reply({ body: viajeActivo() });
    }).as('reanudar');

    login('/manifiestos/812');
    visiblePage().contains('ion-button', 'Pausar').click();
    cy.focused().should('match', 'ion-alert .alert-wrapper');
    cy.get('ion-alert input').type('Almuerzo');
    cy.contains('ion-alert button', 'Pausar').click();
    cy.wait('@pausar');
    // Clicking scrolled the buttons to the top: bring the trip card's title back into view
    // (`scrollIntoView` doesn't scroll an ion-content)
    const alInicio = () => visiblePage().find('ion-content').then(($c) => ($c[0] as HTMLIonContentElement).scrollToTop(0));
    alInicio();
    visiblePage().contains('Seguimiento en pausa').should('be.visible');
    visiblePage().contains('En pausa: Almuerzo').should('be.visible');
    visiblePage().contains('ion-button', 'Reanudar').click();
    cy.wait('@reanudar');
    alInicio();
    visiblePage().contains('Viaje en curso').should('be.visible');
  });

  it('lists the notifications and opens one at its screen', () => {
    const avisos = [
      {
        id: 2,
        tipo: 'sobreanticipo.decidido',
        titulo: 'Sobreanticipo aprobado',
        mensaje: 'MT000812: aprobado por $ 300.000. Queda listo para pago.',
        link: { tipo: 'manifiesto', id: 812, seccion: 'sobreanticipos' },
        prioridad: 'normal',
        creadaEn: '2026-11-02T09:00:00-05:00',
        leida: false,
      },
      {
        id: 1,
        tipo: 'seguimiento.asignado',
        titulo: 'Seguimiento de tu viaje',
        mensaje: 'Tu empresa activó el seguimiento del viaje MT000812.',
        link: { tipo: 'seguimiento', id: 812 },
        prioridad: 'alta',
        creadaEn: '2026-11-01T18:00:00-05:00',
        leida: true,
      },
    ];
    cy.intercept('GET', '**/mobile/notificaciones?*', { body: page(avisos) }).as('avisos');
    cy.intercept('POST', '**/mobile/notificaciones/2/leida', { statusCode: 204 }).as('leida');
    cy.intercept('POST', '**/mobile/notificaciones/leidas', { statusCode: 204 }).as('todas');

    login();
    cy.get('button[aria-label="Notificaciones"]', { includeShadowDom: true }).first().click();
    cy.location('pathname').should('eq', '/notificaciones');
    cy.wait('@avisos');
    visiblePage().contains('Sobreanticipo aprobado').should('be.visible');
    visiblePage().find('[aria-label="Sin leer"]').should('have.length', 1);

    visiblePage().contains('button', 'Sobreanticipo aprobado').click();
    cy.wait('@leida');
    cy.location('pathname').should('eq', '/manifiestos/812');
    cy.location('search').should('eq', '?seccion=sobreanticipos');

    cy.go('back');
    cy.location('pathname').should('eq', '/notificaciones');
    visiblePage().find('[aria-label="Sin leer"]').should('have.length', 0);
  });
});
