import { Router, Request, Response } from 'express';
import products from '../data/products.json';

export const router = Router();

interface Product {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  category: string;
  brand: string;
}

const typedProducts: Product[] = products as Product[];

/**
 * GET /products
 * Query params: ?search=keyword&category=Laptop&page=1&limit=20
 */
router.get('/', (req: Request, res: Response) => {
  const search = (req.query['search'] as string || '').toLowerCase();
  const category = req.query['category'] as string || '';
  const page = parseInt(req.query['page'] as string || '1', 10);
  const limit = parseInt(req.query['limit'] as string || '20', 10);

  let filtered = typedProducts;

  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.productName.toLowerCase().includes(search) ||
        p.productCode.toLowerCase().includes(search),
    );
  }

  if (category) {
    filtered = filtered.filter((p) => p.category === category);
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /products/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const product = typedProducts.find((p) => p.id === req.params['id']);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});
