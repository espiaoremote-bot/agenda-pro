import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await server.ssrLoadModule('/_AppTest.jsx');
  const App = mod.default;
  try {
    const html = renderToString(React.createElement(App));
    console.log('RENDER OK len=' + html.length);
  } catch (e) {
    console.error('RENDER ERROR');
    console.error((e && e.stack) || e);
    process.exit(1);
  }
} finally {
  await server.close();
}
