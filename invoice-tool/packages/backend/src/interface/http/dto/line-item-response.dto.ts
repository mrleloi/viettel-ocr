import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for a single line item in an invoice.
 */
export class LineItemResponseDto {
  @ApiPropertyOptional({ description: 'Product/part code (Mã sản phẩm)' })
  productCode?: string | null;

  @ApiProperty({ description: 'Item name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Unit of measurement' })
  unit?: string | null;

  @ApiProperty({ description: 'Quantity' })
  quantity!: number;

  @ApiProperty({ description: 'Unit price' })
  unitPrice!: number;

  @ApiProperty({ description: 'Amount (quantity × unit price)' })
  amount!: number;

  @ApiPropertyOptional({ description: 'VAT rate' })
  vatRate?: number | null;

  @ApiPropertyOptional({ description: 'VAT amount' })
  vatAmount?: number | null;

  @ApiPropertyOptional({ description: 'Total with VAT' })
  totalWithVat?: number | null;
}
