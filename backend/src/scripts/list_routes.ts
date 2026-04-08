#!/usr/bin/env node
// list_routes.ts
// Lista las rutas de Express disponibles en la aplicación

import userRoutes from '../routes/userRoutes.js';
import authRoutes from '../routes/authRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import { Router } from 'express';

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, unknown>;
  };
}

function listRouter(router: Router): string[] {
  const routes: string[] = [];
  
  (router.stack as unknown[]).forEach((layer: unknown) => {
    const l = layer as RouteLayer;
    if (l.route && l.route.path) {
      const methods = Object.keys(l.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${l.route.path}`);
    }
  });
  
  return routes;
}

console.log('User routes:\n', listRouter(userRoutes).join('\n'));
console.log('\nAuth routes:\n', listRouter(authRoutes).join('\n'));
console.log('\nAdmin routes:\n', listRouter(adminRoutes).join('\n'));

process.exit(0);
