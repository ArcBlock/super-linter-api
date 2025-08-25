beforeAll(() => {
  jest.setTimeout(30000);
});

afterAll(() => {
  // Global cleanup
});

afterEach(() => {
  jest.clearAllMocks();
});