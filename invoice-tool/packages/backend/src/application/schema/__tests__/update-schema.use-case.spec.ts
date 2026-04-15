import { UpdateSchemaUseCase } from '../update-schema.use-case';
import type { ISchemaRepository } from '../../../domain/schema/schema.repository';
import { Schema } from '../../../domain/schema/schema.entity';

function createTestSchema(overrides?: Partial<{ name: string; status: string }>): Schema {
  return Schema.create({
    name: overrides?.name ?? 'Test Schema',
    nccName: 'Test NCC',
    nccTaxId: '0302861742',
    description: 'A test schema',
  });
}

describe('UpdateSchemaUseCase', () => {
  let sut: UpdateSchemaUseCase;
  let schemaRepo: jest.Mocked<ISchemaRepository>;

  beforeEach(() => {
    schemaRepo = {
      findById: jest.fn(),
      findActive: jest.fn(),
    findAll: jest.fn(),
      findByNccTaxId: jest.fn(),
      save: jest.fn(),
    };
    sut = new UpdateSchemaUseCase(schemaRepo);
  });

  describe('execute', () => {
    it('should update name, description, and prompt template', async () => {
      const schema = createTestSchema();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        name: 'Updated Name',
        description: 'Updated description',
        promptTemplate: 'Extract fields: {{fields}}',
      });

      expect(result.name).toBe('Updated Name');
      expect(schema.description).toBe('Updated description');
      expect(schema.promptTemplate).toBe('Extract fields: {{fields}}');
      expect(schemaRepo.save).toHaveBeenCalledWith(schema);
    });

    it('should activate a draft schema', async () => {
      const schema = createTestSchema();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        statusAction: 'activate',
      });

      expect(result.status).toBe('active');
    });

    it('should deactivate an active schema', async () => {
      const schema = createTestSchema();
      schema.activate();
      schemaRepo.findById.mockResolvedValue(schema);

      const result = await sut.execute({
        schemaId: schema.id,
        statusAction: 'deactivate',
      });

      expect(result.status).toBe('inactive');
    });

    it('should throw when schema not found', async () => {
      schemaRepo.findById.mockResolvedValue(null);

      await expect(
        sut.execute({ schemaId: 'nonexistent' }),
      ).rejects.toThrow('Schema not found: nonexistent');
    });
  });
});
