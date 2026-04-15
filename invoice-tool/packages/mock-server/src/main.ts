import express from 'express';
import { router as productsRouter } from './routes/products';

const app = express();
const port = parseInt(process.env['PORT'] ?? '8887', 10);

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mock-viettel-product-api' });
});

// Product routes
app.use('/products', productsRouter);

app.listen(port, () => {
  console.log(`🏪 Mock Viettel Product API running on http://localhost:${port}`);
});
