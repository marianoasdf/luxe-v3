import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lüxe Argentina — Local Multimarca',
  description: 'Local multimarca en Concordia, Entre Ríos. Remeras, buzos, camisas, jeans y más. Envíos a todo el país.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          src="https://sdk.mercadopago.com/js/v2"
          defer
        />
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          defer
        />
      </head>
      <body className="bg-white text-neutral-900 antialiased overflow-x-hidden min-h-screen">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <WhatsAppButton />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
