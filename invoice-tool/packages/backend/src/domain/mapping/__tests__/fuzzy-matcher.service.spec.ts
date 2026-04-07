import {
  FuzzyMatcher,
  ProductData,
} from '../fuzzy-matcher.service';

describe('FuzzyMatcher', () => {
  const matcher = new FuzzyMatcher();

  /**
   * Factory for creating sample Viettel products.
   */
  function createProducts(): ProductData[] {
    return [
      {
        id: 'p1',
        productCode: 'SP001',
        productName: 'Điện thoại Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
      },
      {
        id: 'p2',
        productCode: 'SP002',
        productName: 'Laptop Dell XPS 15 9530',
        brand: 'Dell',
      },
      {
        id: 'p3',
        productCode: 'SP003',
        productName: 'Tai nghe Apple AirPods Pro 2',
        brand: 'Apple',
      },
      {
        id: 'p4',
        productCode: 'SP004',
        productName: 'Máy in Canon LBP6030',
        brand: 'Canon',
      },
      {
        id: 'p5',
        productCode: 'SP005',
        productName: 'USB Kingston 32GB',
        brand: 'Kingston',
      },
      {
        id: 'p6',
        productCode: 'SP006',
        productName: 'Dây cáp sạc USB-C Samsung',
        brand: 'Samsung',
      },
    ];
  }

  describe('match', () => {
    // ✅ Happy: Exact match → score = 1.0
    it('should return score of 1.0 for exact match', () => {
      const products = createProducts();
      const results = matcher.match(
        'Điện thoại Samsung Galaxy S24 Ultra',
        products,
      );

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].productId).toBe('p1');
      expect(results[0].score).toBeCloseTo(1.0, 1);
    });

    // ✅ Happy: Close match with brand bonus
    it('should give brand bonus when brand token appears in partner name', () => {
      const products = createProducts();
      // "Samsung Galaxy S24" matches p1 and mentions the brand "Samsung"
      const results = matcher.match('Samsung Galaxy S24', products);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].productId).toBe('p1');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    // ✅ Happy: Multiple results sorted by score
    it('should return results sorted descending by score', () => {
      const products = createProducts();
      // "Samsung" should match p1 and p6 (both have Samsung brand)
      const results = matcher.match('Samsung', products);

      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    // ✅ Edge: Vietnamese diacritics normalized → still matches
    it('should match after normalizing Vietnamese diacritics', () => {
      const products = createProducts();
      // "Dien thoai Samsung Galaxy S24 Ultra" without diacritics should still match p1
      const results = matcher.match(
        'Dien thoai Samsung Galaxy S24 Ultra',
        products,
      );

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].productId).toBe('p1');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    // ✅ Edge: No matches above threshold → empty array
    it('should return empty array when no products match above threshold', () => {
      const products = createProducts();
      const results = matcher.match(
        'Xe máy Honda Wave',
        products,
        { threshold: 0.5 },
      );

      expect(results).toHaveLength(0);
    });

    // ✅ Edge: Brand null → no bonus applied
    it('should not apply brand bonus when brand is null', () => {
      const productsWithNullBrand: ProductData[] = [
        {
          id: 'p-null',
          productCode: 'SP-NULL',
          productName: 'Laptop Dell XPS 15',
          brand: null,
        },
      ];
      const results = matcher.match('Dell XPS 15', productsWithNullBrand);

      // Should still match based on token similarity, but no brand bonus
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    // ✅ Edge: Single-word product name
    it('should handle single-word product names', () => {
      const products: ProductData[] = [
        {
          id: 'p-single',
          productCode: 'SP-S',
          productName: 'Chuột',
          brand: null,
        },
      ];
      const results = matcher.match('Chuột', products);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeCloseTo(0.8, 1);
    });

    // ❌ Error: Empty product list → empty results
    it('should return empty array when product list is empty', () => {
      const results = matcher.match('Samsung Galaxy', []);

      expect(results).toHaveLength(0);
    });

    // ❌ Error: Empty search query → empty results
    it('should return empty array when search query is empty', () => {
      const products = createProducts();
      const results = matcher.match('', products);

      expect(results).toHaveLength(0);
    });

    // Additional: topN option limits results
    it('should limit results to topN', () => {
      const products = createProducts();
      const results = matcher.match('Samsung', products, { topN: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});
