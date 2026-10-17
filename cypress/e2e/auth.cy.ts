describe('Auth flow (mock service)', () => {
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
  const expectLoginVisible = () => cy.contains('h1', 'Tu operación de carga').should('be.visible');
  const expectAppVisible = () => cy.contains('h1', 'Hola, Andrés').should('be.visible');

  it('redirects guests to /login', () => {
    cy.visit('/remesas');
    expectStableAt('/login');
    expectLoginVisible();
  });

  it('shows an error with invalid credentials', () => {
    cy.visit('/login');
    login('error');
    cy.get('[role="alert"]').should('be.visible').and('contain', 'Usuario o contraseña incorrectos');
    expectStableAt('/login');
  });

  it('logs in when entering through the root URL', () => {
    cy.visit('/');
    expectStableAt('/login');
    expectLoginVisible();
    login();
    expectStableAt('/inicio');
    expectAppVisible();
  });

  it('navigates tabs, keeps the session after reload, logs out and back in', () => {
    cy.visit('/login');
    login();
    expectStableAt('/inicio');
    expectAppVisible();

    // Switching tabs must not be hijacked by a stale redirect
    cy.get('ion-tab-button[tab="remesas"]').click();
    expectStableAt('/remesas');
    cy.contains('ion-content', 'Remesas: pantalla en construcción').should('be.visible');

    // Session persisted: reload stays inside the app
    cy.reload();
    expectStableAt('/remesas');
    cy.contains('ion-content', 'Remesas: pantalla en construcción').should('be.visible');

    // Logged-in users can't go back to /login
    cy.visit('/login');
    expectStableAt('/inicio');
    expectAppVisible();

    // Logout lives in the account menu (avatar)
    cy.get('button[aria-label="Mi cuenta"]').click();
    cy.contains('ion-action-sheet button', 'Cerrar sesión').click();
    expectStableAt('/login');
    expectLoginVisible();

    login();
    expectStableAt('/inicio');
    expectAppVisible();
  });
});
