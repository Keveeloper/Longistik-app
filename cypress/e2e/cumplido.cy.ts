// Driver on the road: cumplir a remesa with photo + GPS, deliveries queued without signal,
// and the manifiesto PDF opened from the copy saved on the phone. Every request is stubbed.

/** Smallest PDF pdf.js renders: one page with "MT000812". */
const PDF_BASE64 = btoa(
  [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
    '4 0 obj<</Length 44>>stream',
    'BT /F1 36 Tf 72 700 Td (MT000812) Tj ET',
    'endstream endobj',
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n')
);

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

const remesaDetalle = {
  ...remesa,
  rndcError: null,
  remitente: { documento: '900123456', nombre: 'Bodega Cali', direccion: 'Cra 1 # 2-3', telefono: '3001234567', municipio: cali },
  destinatario: { documento: '800987654', nombre: 'Almacén Bogotá', direccion: 'Cll 80 # 10-20', telefono: '3109876543', municipio: bogota },
  observaciones: '',
  detalles: [{ producto: 'Abarrotes', cantidad: 120, pesoKg: 8500, valorDeclarado: 45000000 }],
  cumplido: { estadoRndc: null, rndcError: null },
};

const estadoCumplido = {
  remesaId: 4501,
  numero: 'RM0004501',
  puedeCumplir: true,
  motivoNoDisponible: null,
  puedeReintentarRndc: false,
  municipal: false,
  pesoKg: 8500,
  cumplido: { estadoRndc: null, rndcError: null },
  entregas: [],
};

const tiempos = {
  tiempos: {
    cargue: { llegada: '2026-10-20T07:21', entrada: '2026-10-20T07:25', salida: '2026-10-20T07:30' },
    descargue: { llegada: '2026-10-21T14:59', entrada: '2026-10-21T15:01', salida: '2026-10-21T15:04' },
  },
  coherente: true,
  fuenteCargue: 'monitoreo',
  avisos: [],
  mensaje: null,
};

const entregaRegistrada = {
  entrega: {
    id: 17,
    capturadoEn: '2026-10-21T15:20:00-05:00',
    registradoEn: '2026-10-21T15:20:04-05:00',
    registradoPor: 'Andrés Rojas',
    recibidoPor: { nombre: 'Ana Gómez', documento: '1144556677' },
    cantidadEntregadaKg: 8500,
    observaciones: null,
    ubicacion: { latitud: 4.6097102, longitud: -74.0817501, precisionMetros: 8 },
    fotos: [],
    dispositivo: 'web',
    rndc: { estado: 'reportado', mensaje: 'Cumplido de remesa enviado al RNDC. ID: 127368627', tiemposFuente: 'monitoreo' },
  },
  cumplido: { estadoRndc: 'reportado', rndcError: null },
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

const pdf = {
  manifiestoId: 812,
  numero: 'MT000812',
  generadoEn: '2026-10-21T06:10:00-05:00',
  estado: 'activo',
  estadoRndc: 'reportado',
  qrCompleto: true,
  valido: true,
  motivoNoValido: null,
  archivo: 'MT000812.pdf',
  pdfBase64: PDF_BASE64,
};

const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, total: items.length });

describe('Driver on the road', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' });
    cy.intercept('POST', '**/mobile/auth/login', { statusCode: 201, body: { accessToken: 't', expiresIn: 2592000, user: conductor } });
    cy.intercept('GET', '**/mobile/me', { body: { ...conductor, status: true } });
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
    cy.intercept('GET', '**/mobile/manifiestos?*', { body: page([manifiesto]) }).as('manifiestos');
    cy.intercept('GET', '**/mobile/manifiestos/812', { body: { ...manifiesto, remesas: [remesa], novedades: [], rndcError: null } });
    cy.intercept('GET', '**/mobile/manifiestos/812/pdf', { body: pdf }).as('pdf');
    cy.intercept('GET', '**/mobile/remesas?*', { body: page([remesa]) }).as('remesas');
    cy.intercept('GET', '**/mobile/remesas/4501', { body: remesaDetalle });
    cy.intercept('GET', '**/mobile/remesas/4501/cumplido', { body: estadoCumplido }).as('estado');
    cy.intercept('GET', '**/mobile/remesas/4501/cumplido/tiempos', { body: tiempos }).as('tiempos');
  });

  const visitSignedIn = (path: string) => {
    cy.visit('/', {
      onBeforeLoad(win) {
        // Phone GPS in Bogotá
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) =>
          ok({ coords: { latitude: 4.6097102, longitude: -74.0817501, accuracy: 8 }, timestamp: Date.now() })
        );
      },
    });
    cy.contains('ion-item', 'STAGING').click();
    cy.get('input[autocomplete="username"]').type('andres@longistik.com');
    cy.get('input[type="password"]').type('secret');
    cy.contains('ion-button', 'Ingresar').click();
    cy.contains('h1', 'Hola, Andrés').should('be.visible');
    if (path !== '/inicio') cy.get(`ion-tab-button[tab="${path.slice(1)}"]`).click();
  };

  const visiblePage = () => cy.get('.ion-page:not(.ion-page-hidden)').last();

  // Ionicons loads each SVG the first time it is used: wait for the visible ones before a screenshot
  const screenshot = (name: string) => {
    visiblePage().find('ion-icon:visible').each((icon) => cy.wrap(icon).shadow().find('svg'));
    cy.screenshot(name, { capture: 'viewport' });
  };

  const cumplirConFoto = () => {
    cy.contains('ion-button', 'Cumplir remesa').should('be.visible').click();
    cy.location('pathname').should('eq', '/remesas/4501/cumplir');
    cy.contains('4.60971, -74.08175').should('be.visible');
    cy.contains('button', 'Tomar foto').click();
    cy.get('#_capacitor-camera-input-takephoto').selectFile('src/assets/logo-longistik.png', { force: true });
    cy.get('img[alt="Foto 1"]').should('be.visible');
    cy.contains('Falta quién recibe').should('be.visible');
    cy.get('ion-input input').first().type('Ana Gómez');
  };

  it('cumple una remesa con foto, ubicación y tiempos del monitoreo', () => {
    let request: { headers: Record<string, string | string[]>; body: string } | undefined;
    cy.intercept('POST', '**/mobile/remesas/4501/cumplido', (req) => {
      // Multipart arrives as raw bytes
      const body = typeof req.body === 'string' ? req.body : new TextDecoder().decode(new Uint8Array(req.body));
      request = { headers: req.headers, body };
      req.reply({ statusCode: 201, body: entregaRegistrada });
    }).as('cumplir');

    visitSignedIn('/remesas');
    cy.contains('RM0004501').should('be.visible').click();
    cy.contains('Bodega Cali').should('be.visible');
    cumplirConFoto();
    cy.wait('@tiempos');
    cy.contains('Se enviará con los tiempos del monitoreo GPS del RNDC').should('be.visible');
    screenshot('cumplir-formulario');

    cy.contains('ion-button', 'Registrar entrega').click();
    cy.wait('@cumplir').then(() => {
      expect(request?.headers['idempotency-key']).to.match(/^[0-9a-f-]{36}$/);
      expect(request?.body).to.include('name="recibidoNombre"').and.include('Ana Gómez');
      expect(request?.body).to.include('name="latitud"').and.include('4.6097102');
      expect(request?.body).to.include('name="fotos"; filename="foto-1.jpg"');
      // Times are left to the backend (monitoring) unless the driver adjusts them
      expect(request?.body).not.to.include('name="tiempos"');
    });
    cy.contains('h1', 'Entrega registrada').should('be.visible');
    cy.contains('Cumplido reportado al RNDC').should('be.visible');
    screenshot('cumplir-resultado');
  });

  it('sin señal guarda la entrega en el teléfono y la envía después', () => {
    cy.intercept('POST', '**/mobile/remesas/4501/cumplido', { forceNetworkError: true }).as('sinSenal');

    visitSignedIn('/remesas');
    cy.contains('RM0004501').click();
    cumplirConFoto();
    cy.contains('ion-button', 'Registrar entrega').click();
    cy.wait('@sinSenal');
    cy.contains('h1', 'Entrega guardada en el teléfono').should('be.visible');
    cy.contains('ion-button', 'Volver a la remesa').click();

    visiblePage().contains('Entrega guardada en el teléfono').should('be.visible');
    screenshot('remesa-en-cola');

    // Signal is back: the same key goes out and the queue empties
    const keys: string[] = [];
    cy.intercept('POST', '**/mobile/remesas/4501/cumplido', (req) => {
      keys.push(String(req.headers['idempotency-key']));
      req.reply({ statusCode: 201, body: entregaRegistrada });
    }).as('reenvio');
    cy.intercept('GET', '**/mobile/remesas/4501/cumplido', {
      body: { ...estadoCumplido, puedeCumplir: false, entregas: [entregaRegistrada.entrega], cumplido: entregaRegistrada.cumplido },
    });
    visiblePage().contains('Enviar ahora').click();
    cy.wait('@reenvio').then(() => expect(keys).to.have.length(1));
    visiblePage().contains('Entrega guardada en el teléfono').should('not.exist');
    visiblePage().contains('Cumplida en el RNDC').should('exist');
    visiblePage().contains('Recibió').should('contain.text', 'Ana Gómez');
    screenshot('remesa-cumplida');
  });

  it('muestra el manifiesto y lo abre sin señal desde la copia guardada', () => {
    visitSignedIn('/manifiestos');
    cy.contains('MT000812').should('be.visible').click();
    visiblePage().contains('Válido para mostrar en vía').should('be.visible');
    visiblePage().contains('Guardado en el teléfono').should('be.visible');
    screenshot('manifiesto-detalle');

    cy.contains('ion-button', 'Ver manifiesto').click();
    cy.location('pathname').should('eq', '/manifiestos/812/documento');
    visiblePage().find('canvas').should('have.length', 1).and('be.visible');
    screenshot('manifiesto-pdf');

    // No signal: reload the app; the PDF comes from the phone
    cy.intercept('GET', '**/mobile/**', { forceNetworkError: true });
    cy.reload();
    visiblePage().find('canvas').should('have.length', 1).and('be.visible');
    visiblePage().contains('Válido para mostrar en vía').should('be.visible');
  });
});
