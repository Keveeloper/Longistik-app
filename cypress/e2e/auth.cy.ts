// The panel and the company backend (request/mobile-api.md) are stubbed, so the suite runs without real accounts
describe('Company + auth flow', () => {
  const despachador = {
    id: 34,
    name: 'Andrés',
    lastName: 'Rojas',
    email: 'ana@longistik.com',
    role: 'Despachador',
    alcance: 'todos',
    permisos: [
      'app.acceso',
      'manifiestos.ver_todos',
      'manifiestos.crear',
      'remesas.crear',
      'remesas.cumplir',
      'novedades.reportar',
      'rndc.enviar',
    ],
    vehiculos: [],
  };
  const conductor = {
    ...despachador,
    role: 'Conductor',
    alcance: 'asignados',
    permisos: ['app.acceso', 'manifiestos.ver_asignados', 'remesas.cumplir', 'novedades.reportar'],
    vehiculos: [{ id: 12, placa: 'ABC123', desde: '2026-10-21T00:00:00-05:00', hasta: null }],
  };

  /** Login and /mobile/me answer with this user */
  const stubUser = (user: object) => {
    cy.intercept('POST', '**/mobile/auth/login', (req) => {
      if (req.body.password === 'error') {
        req.reply({
          statusCode: 401,
          body: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' },
        });
      } else {
        req.reply({ statusCode: 201, body: { accessToken: 'test.jwt.token', expiresIn: 2592000, user } });
      }
    }).as('login');
    cy.intercept('GET', '**/mobile/me', { body: { ...user, status: true } }).as('me');
  };

  beforeEach(() => {
    cy.intercept('GET', '**/api/public/companies*', { fixture: 'companies.json' }).as('companies');
    stubUser(despachador);
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' }).as('summary');
  });

  const quickActionLabels = () =>
    cy.get('nav[aria-label="Acciones rápidas"] button').then(($b) => [...$b].map((b) => b.innerText.replace(/\s+/g, ' ')));

  const selectCompany = (name = 'Servicargas 360 S.A.S.') => cy.contains('ion-item', name).click();

  const login = (password = 'secret') => {
    cy.get('input[autocomplete="username"]').type('ana@longistik.com');
    cy.get('input[type="password"]').type(password);
    cy.contains('ion-button', 'Ingresar').click();
  };

  // Catches redirect loops: the URL must stay put, not just pass through `path`
  const expectStableAt = (path: string) => {
    cy.location('pathname').should('eq', path);
    cy.window().then((win) => {
      const start = win.history.length;
      cy.wait(1000);
      cy.location('pathname').should('eq', path);
      cy.window().its('history.length').should('eq', start);
    });
  };

  // Ionic can leave a page mounted but stuck invisible (opacity 0), so check what's on screen
  const expectSelectorVisible = () => cy.contains('h1', '¿Para qué empresa trabajas?').should('be.visible');
  const expectLoginVisible = () => cy.contains('h1', 'Tu operación de carga').should('be.visible');
  const expectAppVisible = () => cy.contains('h1', 'Hola, Andrés').should('be.visible');

  it('sends first-time visitors to the company selector', () => {
    cy.visit('/remesas');
    expectStableAt('/empresa');
    expectSelectorVisible();

    cy.visit('/login');
    expectStableAt('/empresa');
    expectSelectorVisible();
  });

  it('searches companies ignoring case and accents', () => {
    cy.visit('/empresa');
    cy.get('ion-item.company-row').should('have.length', 3);
    cy.get('input[type="search"]').type('LOGISTICA');
    cy.get('ion-item.company-row').should('have.length', 1).and('contain', 'Carga Andina Logística');
    cy.get('input[type="search"]').clear().type('transvalle');
    cy.get('ion-item.company-row').should('have.length', 1).and('contain', 'Transportes del Valle');
    cy.get('input[type="search"]').clear().type('zzz');
    cy.contains('No encontramos empresas').should('be.visible');
  });

  it('remembers the company and lets the user change it from the login', () => {
    cy.visit('/');
    expectStableAt('/empresa');
    selectCompany();
    expectStableAt('/login');
    expectLoginVisible();
    cy.contains('Servicargas 360 S.A.S.').should('be.visible');

    // The choice is persisted: reload stays on the login
    cy.reload();
    expectStableAt('/login');
    cy.contains('Servicargas 360 S.A.S.').should('be.visible');

    cy.get('button[aria-label="Cambiar de empresa"]').click();
    expectStableAt('/empresa');
    expectSelectorVisible();

    selectCompany('Transportes del Valle S.A.S.');
    expectStableAt('/login');
    cy.contains('Transportes del Valle S.A.S.').should('be.visible');
  });

  it('shows an error with invalid credentials', () => {
    cy.visit('/');
    selectCompany();
    login('error');
    cy.get('[role="alert"]').should('be.visible').and('contain', 'Correo o contraseña incorrectos');
    expectStableAt('/login');
  });

  it('logs in against the selected company backend', () => {
    cy.visit('/');
    selectCompany('Transportes del Valle S.A.S.');
    login();
    cy.wait('@login').then(({ request }) => {
      expect(request.url).to.eq('https://api.transvalle.longistik.com/mobile/auth/login');
      expect(request.body).to.deep.eq({ email: 'ana@longistik.com', password: 'secret' });
    });
    expectStableAt('/inicio');
    cy.contains('header', 'Transportes del Valle S.A.S.').should('be.visible');
  });

  it('shows the home summary from the API', () => {
    cy.visit('/');
    selectCompany();
    login();
    cy.wait('@summary').its('request.headers.authorization').should('eq', 'Bearer test.jwt.token');
    cy.contains('9 remesas').should('be.visible');
    cy.contains('4 manifiestos despachados').should('be.visible');
    cy.contains('Tienes 3 remesas pendientes por enviar al RNDC').should('be.visible');
    cy.contains('149 de 152 remesas reportadas').should('be.visible');
    cy.get('.home-row-count').should('have.text', '6');
  });

  it('shows a retry when the summary fails', () => {
    cy.intercept('GET', '**/mobile/home/summary', { statusCode: 500, body: { statusCode: 500, message: 'Falla' } });
    cy.visit('/');
    selectCompany();
    login();
    cy.contains('[role="alert"]', 'Falla').should('be.visible');
    cy.intercept('GET', '**/mobile/home/summary', { fixture: 'home-summary.json' });
    cy.contains('[role="alert"] button', 'Reintentar').click();
    cy.contains('9 remesas').should('be.visible');
    cy.get('[role="alert"]').should('not.exist');
  });

  it('closes the session when the user was deactivated', () => {
    cy.visit('/');
    selectCompany();
    login();
    expectStableAt('/inicio');

    // On the next launch /mobile/me answers 403 USER_INACTIVE
    const message = 'Tu usuario está inactivo. Contacta al administrador.';
    cy.intercept('GET', '**/mobile/me', { statusCode: 403, body: { statusCode: 403, code: 'USER_INACTIVE', message } });
    cy.reload();
    expectStableAt('/login');
    expectLoginVisible();
    cy.contains('[role="alert"]', message).should('be.visible');
  });

  it('keeps the session on a 403 FORBIDDEN (missing permission)', () => {
    const message = 'No tienes permiso para esta acción.';
    cy.intercept('GET', '**/mobile/home/summary', { statusCode: 403, body: { statusCode: 403, code: 'FORBIDDEN', message } });
    cy.visit('/');
    selectCompany();
    login();
    cy.contains('[role="alert"]', message).should('be.visible');
    expectStableAt('/inicio');
    expectAppVisible();
  });

  it('shows the despachador every action', () => {
    cy.visit('/');
    selectCompany();
    login();
    expectAppVisible();
    quickActionLabels().should('deep.eq', ['Nuevo manifiesto', 'Nueva remesa', 'Reportar novedad', 'Cumplir remesa']);
    cy.contains('button', 'Revisar y enviar').should('be.visible');
  });

  it('shows a conductor only their actions and vehicles', () => {
    stubUser(conductor);
    cy.visit('/');
    selectCompany();
    login();
    expectAppVisible();
    quickActionLabels().should('deep.eq', ['Reportar novedad', 'Cumplir remesa']);
    cy.contains('Tienes 3 remesas pendientes').should('be.visible');
    cy.contains('button', 'Revisar y enviar').should('not.exist');
    cy.contains('No tienes vehículos asignados').should('not.exist');

    cy.get('button[aria-label="Mi cuenta"]').click();
    cy.get('ion-action-sheet').should('contain', 'ABC123');
  });

  it('tells a conductor without vehicles, and picks up a new assignment on resume', () => {
    stubUser({ ...conductor, vehiculos: [] });
    cy.visit('/');
    selectCompany();
    login();
    expectAppVisible();
    cy.contains('No tienes vehículos asignados').should('be.visible');
    cy.contains('ion-item', 'Mis manifiestos activos').should('not.exist');

    // The admin assigns a vehicle while the app is in the background
    stubUser(conductor);
    cy.document().then((doc) => doc.dispatchEvent(new Event('visibilitychange')));
    cy.wait('@me');
    cy.contains('No tienes vehículos asignados').should('not.exist');
    cy.contains('ion-item', 'Mis manifiestos activos').should('be.visible');
  });

  it('requests a password reset email', () => {
    cy.intercept('POST', '**/public/authentication/forgot-password', { statusCode: 201, body: {} }).as('forgot');
    cy.visit('/');
    selectCompany();
    cy.contains('button', '¿Olvidaste tu contraseña?').click();
    cy.contains('[role="alert"]', 'Ingresa tu correo').should('be.visible');
    cy.get('input[autocomplete="username"]').type('ana@longistik.com');
    cy.contains('button', '¿Olvidaste tu contraseña?').click();
    cy.wait('@forgot').its('request.body').should('deep.eq', { email: 'ana@longistik.com' });
    // The toast message renders inside its Shadow DOM
    cy.get('ion-toast').shadow().find('.toast-message').should('contain.text', 'te enviaremos un enlace');
  });

  it('navigates tabs, keeps the session after reload, logs out and back in', () => {
    cy.visit('/');
    selectCompany();
    login();
    expectStableAt('/inicio');
    expectAppVisible();
    cy.contains('header', 'Servicargas 360 S.A.S.').should('be.visible');

    // Switching tabs must not be hijacked by a stale redirect
    cy.get('ion-tab-button[tab="remesas"]').click();
    expectStableAt('/remesas');
    cy.contains('ion-content', 'Remesas: pantalla en construcción').should('be.visible');

    // Session persisted: reload stays inside the app
    cy.reload();
    expectStableAt('/remesas');
    cy.contains('ion-content', 'Remesas: pantalla en construcción').should('be.visible');

    // Logged-in users can't go back to the entry screens
    cy.visit('/login');
    expectStableAt('/inicio');
    expectAppVisible();
    cy.visit('/empresa');
    expectStableAt('/inicio');
    expectAppVisible();
    cy.visit('/');
    expectStableAt('/inicio');
    expectAppVisible();

    // Logout lives in the account menu (avatar); the company is kept
    cy.get('button[aria-label="Mi cuenta"]').click();
    cy.contains('ion-action-sheet button', 'Cerrar sesión').click();
    expectStableAt('/login');
    expectLoginVisible();
    // Scoped to the login: the hidden Inicio page also shows the company name
    cy.get('button[aria-label="Cambiar de empresa"]').parent().should('contain', 'Servicargas 360 S.A.S.');

    login();
    expectStableAt('/inicio');
    expectAppVisible();
  });
});
