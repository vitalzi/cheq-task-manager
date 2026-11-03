import { setupServer } from 'msw/node';

// Shared by setup.ts (lifecycle) and FakeApi (the handlers each test installs).
export const server = setupServer();
