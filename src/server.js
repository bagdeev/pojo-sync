const { Server } = require('@hocuspocus/server');

const server = Server.configure({
    name: 'hocuspocus-eu1-01',
    port: 1234,
    timeout: 30000,
    debounce: 5000,
    maxDebounce: 30000,
    quiet: false,
});

server.listen();
