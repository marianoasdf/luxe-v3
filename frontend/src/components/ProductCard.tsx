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
      <Link
        href={`/producto/${producto.slug || producto.id}`}
        className="block overflow-hidden select-none"
        style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none' }}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
          <Image
            src={cdnImage(producto.img)}
            alt={producto.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-95"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />
        </div>
      </Link>
      <div className="mt-4 space-y-1.5">
        <Link
          href={`/producto/${producto.slug || producto.id}`}
          className="block select-none"
          style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none' }}
        >
          <h3 className="text-sm font-medium text-neutral-900 group-hover:text-neutral-600 transition-colors duration-300 leading-tight">
            {producto.name}
          </h3>
        </Link>
        {producto.desc && (
          <p className="text-xs text-neutral-400 line-clamp-1">{producto.desc}</p>
        )}
        <p className="text-sm font-semibold text-neutral-900 tracking-tight">
          {formatoPrecio(producto.price)}
        </p>
      </div>
    </div>
  );
}
