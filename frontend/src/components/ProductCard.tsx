import Link from 'next/link';
import Image from 'next/image';
import { formatoPrecio, cdnImage } from '@/lib/utils';
import type { ProductMapped } from '@/types';

interface ProductCardProps {
  producto: ProductMapped;
}

export default function ProductCard({ producto }: ProductCardProps) {
  return (
    <div className="group">
      <Link href={`/producto/${producto.slug || producto.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={cdnImage(producto.img)}
            alt={producto.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>
      <div className="mt-3 space-y-1">
        <Link href={`/producto/${producto.slug || producto.id}`} className="block">
          <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            {producto.name}
          </h3>
        </Link>
        <p className="text-sm text-gray-500 line-clamp-2">{producto.desc}</p>
        <p className="text-sm font-semibold text-gray-900">{formatoPrecio(producto.price)}</p>
      </div>
    </div>
  );
}
