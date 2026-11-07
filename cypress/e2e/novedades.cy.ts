// Novedades del manifiesto (request/novedades-manifiesto.md): the driver reports them, with the
// manifiesto chosen from its detail, photos and GPS; without signal they wait on the phone.
// Only the web takes and closes them: the app shows them read-only. Every request is stubbed.

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

const remesa = {
  id: 4501,
  numero: 'RM0004501',
  consecutivoRndc: '987654321',
  fecha: '2026-10-20T08:00:00-05:00',
  estado: 'manifiesto',
  estadoRndc: 'reportado',
  manifiestoId: 812,
  cliente: { id: 15, nombre: 'Distribuidora XYZ S.A.S.' },
  origen: cali,
  destino: bogota,
  producto: 'Abarrotes',
  cantidad: 120,
  pesoKg: 8500,
};

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
  remesas: 1,
  valorFlete: 3200000,
};

const haceMinutos = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const novedad = (extra: Record<string, unknown> = {}) => ({
  id: 90,
  tipo: { codigo: 'varada', nombre: 'Vehículo varado' },
  rndc: { tramite: 'suspension', codigo: 'V', descripcion: 'Suspensión del manifiesto, motivo V (varada)' },
  critica: false,
  estado: 'abierta',
  descripcion: 'Se rompió la caja de cambios en el km 40',
  capturadaEn: haceMinutos(25),
  recibidaEn: haceMinutos(24),
  reportadaDesde: 'app',
  manifiesto: { id: 812, numero: 'MT000812', placa: 'ABC123', origen: cali, destino: bogota },
  remesa: null,
  reportadaPor: { id: 34, nombre: 'Andrés Rojas' },
  gestionadaPor: null,
  gestionadaEn: null,
  cerradaPor: null,
  cerradaEn: null,
  resolucion: null,
  ubicacion: { latitud: 4.6097102, longitud: -74.0817501, precisionMetros: 8 },
  ...extra,
});

const enGestion = novedad({
  id: 91,
  tipo: { codigo: 'accidente', nombre: 'Accidente' },
  critica: true,
  estado: 'en_gestion',
  descripcion: 'Choque leve con una moto en el peaje',
  capturadaEn: haceMinutos(125),
  gestionadaPor: { id: 5, nombre: 'Laura Gómez' },
});

const cerrada = novedad({
  id: 92,
  tipo: { codigo: 'faltante', nombre: 'Faltante de carga' },
  rndc: { tramite: 'descuento', codigo: 'F', descripcion: 'Descuento en el cumplido del manifiesto, motivo F (faltante)' },
  estado: 'cerrada',
  descripcion: 'Faltan 3 cajas de la remesa',
  capturadaEn: haceMinutos(60 * 26),
  remesa: { id: 4501, numero: 'RM0004501' },
  gestionadaPor: { id: 5, nombre: 'Laura Gómez' },
  cerradaPor: { id: 5, nombre: 'Laura Gómez' },
  cerradaEn: haceMinutos(60 * 20),
  resolucion: 'El cliente confirmó el faltante; se descuenta en el cumplido.',
});

const detalle = (n: ReturnType<typeof novedad>) => ({
  ...n,
  conductor: { id: 7, nombre: 'Andrés Rojas' },
  viajeId: null,
  fotos: [],
  historial: [
    { tipo: 'creada', texto: null, por: { id: 34, nombre: 'Andrés Rojas' }, en: n.capturadaEn },
    ...(n.cerradaEn ? [{ tipo: 'cerrada', texto: n.resolucion, por: n.cerradaPor, en: n.cerradaEn }] : []),
  ],
});

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length });

describe('Novedades', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' });
    cy.intercept('POST', '**/mobile/auth/login', { statusCode: 201, body: { accessToken: 't', expiresIn: 2592000, user: conductor } });
    cy.intercept('GET', '**/mobile/me', { body: { ...conductor, status: true } });
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
    cy.intercept('GET', '**/mobile/manifiestos?*', { body: page([manifiesto]) });
    cy.intercept('GET', '**/mobile/manifiestos/812', { body: { ...manifiesto, remesas: [remesa], novedades: [novedad()], rndcError: null } });
    cy.intercept('GET', '**/mobile/manifiestos/812/pdf', { statusCode: 404, body: { message: 'No' } });
    cy.intercept('GET', '**/mobile/manifiestos/812/sobreanticipos', { statusCode: 403, body: { code: 'FORBIDDEN', message: 'No' } });
    cy.intercept('GET', '**/mobile/remesas?*', { body: page([remesa]) });
    cy.intercept('GET', '**/mobile/novedades?*', (req) =>
      req.reply({ body: page(req.query.vista === 'cerradas' ? [cerrada] : [novedad(), enGestion]) })
    ).as('novedades');
    cy.intercept('GET', '**/mobile/novedades/92', { body: detalle(cerrada) });
  });

  const entrar = () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) =>
          ok({ coords: { latitude: 4.6097102, longitude: -74.0817501, accuracy: 8 }, timestamp: Date.now() })
        );
      },
    });
    cy.contains('ion-item', 'STAGING').click();
    cy.get('input[autocomplete="username"]').type(conductor.email);
    cy.get('input[type="password"]').type('secret');
    cy.contains('ion-button', 'Ingresar').click();
    cy.contains('h1', 'Hola, Andrés').should('be.visible');
  };

  const visiblePage = () => cy.get('.ion-page:not(.ion-page-hidden)').last();
  const filas = () => visiblePage().find('.novedad-fila');

  it('lista las abiertas y las cerradas, y abre el detalle de solo lectura', () => {
    entrar();
    cy.get('ion-tab-button[tab="novedades"]').click();
    cy.location('pathname').should('eq', '/novedades');
    visiblePage().contains('2 abiertas').should('be.visible');
    visiblePage().contains('En 1 manifiesto').should('be.visible');
    filas().should('have.length', 2);
    filas().first().should('contain', 'Vehículo varado').and('contain', 'Hace 25 min').and('contain', 'MT000812 · Cali → Bogotá');
    filas().first().should('contain', 'Abierta').and('contain', 'Reportó Andrés Rojas');
    filas().eq(1).should('contain', 'Accidente').and('contain', 'En gestión').and('contain', 'Asignada a Laura Gómez');

    visiblePage().contains('ion-segment-button', 'Cerradas').click();
    visiblePage().contains('1 cerrada').should('be.visible');
    filas().should('have.length', 1).first().should('contain', 'Cerrada por Laura Gómez').click();

    cy.location('pathname').should('eq', '/novedades/92');
    visiblePage().contains('h1', 'Faltante de carga').should('be.visible');
    visiblePage().contains('El cliente confirmó el faltante').should('be.visible');
    visiblePage().contains('Descuento en el cumplido del manifiesto, motivo F').should('exist');
    visiblePage().contains('RM0004501').should('exist');
    // Read-only: the app has no actions that change the state
    visiblePage().contains('ion-button', /Cerrar|Tomar/).should('not.exist');
  });

  it('reporta desde el manifiesto: pide la remesa en un faltante y envía foto, GPS y la llave', () => {
    let request: { headers: Record<string, string | string[]>; body: string } | undefined;
    cy.intercept('POST', '**/mobile/novedades', (req) => {
      const body = typeof req.body === 'string' ? req.body : new TextDecoder().decode(new Uint8Array(req.body));
      request = { headers: req.headers, body };
      req.reply({ statusCode: 201, body: detalle(novedad({ id: 93, tipo: { codigo: 'faltante', nombre: 'Faltante de carga' } })) });
    }).as('reportar');
    cy.intercept('GET', '**/mobile/novedades/93', {
      body: detalle(novedad({ id: 93, tipo: { codigo: 'faltante', nombre: 'Faltante de carga' } })),
    });

    entrar();
    cy.get('ion-tab-button[tab="manifiestos"]').click();
    visiblePage().contains('MT000812').should('be.visible').click();
    visiblePage().contains('h2', 'Novedades').should('exist');
    visiblePage().find('.novedad-fila').should('contain', 'Vehículo varado');
    visiblePage().contains('ion-button', 'Reportar novedad').click({ force: true });

    cy.location('pathname').should('eq', '/novedades/reportar');
    cy.location('search').should('eq', '?manifiestoId=812');
    visiblePage().find('[role="radio"][aria-checked="true"]').should('contain', 'MT000812');
    visiblePage().contains('[role="radio"]', 'Faltante de carga').click();
    visiblePage().contains('Remesa afectada').should('be.visible');
    visiblePage().contains('Falta la remesa y qué pasó').should('be.visible');
    visiblePage().contains('[role="radio"]', 'RM0004501').click();
    visiblePage().find('ion-textarea textarea').type('Faltan 3 cajas de abarrotes al revisar la carga');
    visiblePage().contains('button', 'Tomar foto').click();
    cy.get('#_capacitor-camera-input-takephoto').selectFile('src/assets/logo-longistik.png', { force: true });
    cy.get('img[alt="Foto 1"]').should('be.visible');
    visiblePage().contains('4.60971, -74.08175').should('be.visible');

    visiblePage().contains('ion-button', 'Reportar novedad').click();
    cy.wait('@reportar').then(() => {
      expect(request?.headers['idempotency-key']).to.match(/^[0-9a-f-]{36}$/);
      expect(request?.body).to.include('name="manifiestoId"').and.include('812');
      expect(request?.body).to.include('name="tipo"').and.include('faltante');
      expect(request?.body).to.include('name="remesaId"').and.include('4501');
      expect(request?.body).to.include('name="latitud"').and.include('4.6097102');
      expect(request?.body).to.include('name="fotos"; filename="foto-1.jpg"');
    });
    cy.contains('h1', 'Novedad reportada').should('be.visible');
    cy.contains('ion-button', 'Ver la novedad').click();
    cy.location('pathname').should('eq', '/novedades/93');
  });

  it('sin señal la guarda en el teléfono, la muestra pendiente y la reenvía con la misma llave', () => {
    cy.intercept('POST', '**/mobile/novedades', { forceNetworkError: true }).as('sinSenal');

    entrar();
    cy.get('ion-tab-button[tab="novedades"]').click();
    visiblePage().find('ion-button[aria-label="Reportar novedad"]').click();
    cy.location('pathname').should('eq', '/novedades/reportar');
    // A single active manifiesto comes chosen
    visiblePage().find('[role="radio"][aria-checked="true"]').should('contain', 'MT000812');
    visiblePage().contains('[role="radio"]', 'Vía afectada').click();
    visiblePage().contains('Remesa (opcional)').should('be.visible');
    visiblePage().find('ion-textarea textarea').type('Derrumbe en la vía, paso cerrado hasta nueva orden');
    visiblePage().contains('ion-button', 'Reportar novedad').click();
    cy.wait('@sinSenal');
    cy.contains('h1', 'Novedad guardada en el teléfono').should('be.visible');
    cy.contains('ion-button', 'Volver').click();

    cy.location('pathname').should('eq', '/novedades');
    filas().first().should('contain', 'Vía afectada').and('contain', 'Pendiente de envío');

    const keys: string[] = [];
    cy.intercept('POST', '**/mobile/novedades', (req) => {
      keys.push(String(req.headers['idempotency-key']));
      req.reply({ statusCode: 201, body: detalle(novedad({ id: 94 })) });
    }).as('reenvio');
    filas().first().click();
    cy.wait('@reenvio');
    visiblePage().contains('Pendiente de envío').should('not.exist');
    cy.wrap(keys).should('have.length', 1);
  });

  it('el aviso de la campana abre la novedad', () => {
    cy.intercept('GET', '**/mobile/notificaciones?*', {
      body: page([
        {
          id: 3,
          tipo: 'novedad.cerrada',
          titulo: 'Tu novedad fue cerrada',
          mensaje: 'Faltante de carga (manifiesto MT000812): El cliente confirmó el faltante.',
          link: { tipo: 'novedad', id: 92 },
          prioridad: 'normal',
          creadaEn: haceMinutos(10),
          leida: false,
        },
      ]),
    });
    cy.intercept('POST', '**/mobile/notificaciones/3/leida', { statusCode: 204 }).as('leida');

    entrar();
    cy.get('button[aria-label="Notificaciones"]', { includeShadowDom: true }).first().click();
    cy.location('pathname').should('eq', '/notificaciones');
    visiblePage().contains('button', 'Tu novedad fue cerrada').click();
    cy.wait('@leida');
    cy.location('pathname').should('eq', '/novedades/92');
    visiblePage().contains('h1', 'Faltante de carga').should('be.visible');
  });

  it('sin el permiso no se puede reportar', () => {
    const sinPermiso = { ...conductor, permisos: ['app.acceso', 'manifiestos.ver_asignados'] };
    cy.intercept('POST', '**/mobile/auth/login', { statusCode: 201, body: { accessToken: 't', expiresIn: 2592000, user: sinPermiso } });
    cy.intercept('GET', '**/mobile/me', { body: { ...sinPermiso, status: true } });

    entrar();
    cy.get('ion-tab-button[tab="novedades"]').click();
    visiblePage().contains('h1', 'Novedades').should('be.visible');
    visiblePage().find('ion-button[aria-label="Reportar novedad"]').should('not.exist');
    cy.get('ion-tab-button[tab="manifiestos"]').click();
    visiblePage().contains('MT000812').should('be.visible').click();
    visiblePage().contains('h2', 'Novedades').should('exist');
    visiblePage().contains('ion-button', 'Reportar novedad').should('not.exist');
  });
});
