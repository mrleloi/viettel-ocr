import { CreateMappingUseCase } from '../create-mapping.use-case';
import type { IMappingRepository } from '../../../domain/mapping/mapping.repository';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import { Schema } from '../../../domain/schema/schema.entity';

function createTestSchema(): Schema {
  return Schema.create({
    name: 'Test Schema',
    nccName: 'Test NCC',
    nccTaxId: '0302861742',
  });
}

describe('CreateMappingUseCase', () => {
  let sut: CreateMappingUseCase;
  let mappingRepo: jest.Mocked<IMappingRepository>;
  let schemaRepo: jest.Mocked<ISchemaRepository>;

  beforeEach(() => {
    mappingRepo = {
      findByPartnerName: jest.fn(),
      findBySchemaId: jest.fn(),
      incrementUsage: jest.fn(),
      save: jest.fn(),
    };
    schemaRepo = {
      findById: jest.fn(),
      findActive: jest.fn(),
      findByNccTaxId: jest.fn(),
      save: jest.fn(),
    };
    sut = new CreateMappingUseCase(mappingRepo, schemaRepo);
  });

  describe('execute', () => {
    it('should create a manual mapping', async () => {
      const schema = createTestSchema();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        partnerProductName: 'Partner Phone X',
        viettelProductCode: 'VT-001',
        source: 'manual',
      });

      expect(result.partnerProductName).toBe('Partner Phone X');
      expect(result.viettelProductCode).toBe('VT-001');
      expect(result.status).toBe('active');
      expect(mappingRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should create an auto-learned mapping with pending_review status', async () => {
      const schema = createTestSchema();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        partnerProductName: 'Auto Learned Item',
        viettelProductCode: 'VT-002',
        source: 'auto_learned',
        confidence: 0.85,
      });

      expect(result.status).toBe('pending_review');
      expect(mappingRepo.save).toHaveBeenCalled();
    });

    it('should throw when schema not found', async () => {
      schemaRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({
          schemaId: 'nonexistent',
          partnerProductName: 'Phone',
          viettelProductCode: 'VT-001',
          source: 'manual',
        }),
      ).rejects.toThrow('Schema not found: nonexistent');
    });

    it('should create a bulk import mapping', async () => {
      const schema = createTestSchema();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        partnerProductName: 'Bulk Item',
        viettelProductCode: 'VT-003',
        viettelProductName: 'Viettel Product 3',
        source: 'bulk_import',
      });

      expect(result.status).toBe('active');
      expect(result.mappingId).toBeDefined();
    });
  });
});
