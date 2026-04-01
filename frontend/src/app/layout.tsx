import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import Header from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Luxe - Moda Urbana',
  description: 'Moda urbana y estilo para todos los días',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script
          src="https://sdk.mercadopago.com/js/v2"
          defer
        />
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          defer
        />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>
            <Header />
            <main>{children}</main>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
