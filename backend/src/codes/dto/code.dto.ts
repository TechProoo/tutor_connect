import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCodeDto {
  @IsUUID()
  guideId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  buyerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  buyerPhone: string;

  @IsEmail()
  @MaxLength(160)
  buyerEmail: string;
}

export class UpdateBuyerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  buyerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  buyerPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  buyerEmail?: string;
}

export class ListCodesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['UNUSED', 'REDEEMED', 'DISABLED', 'REVOKED'])
  status?: 'UNUSED' | 'REDEEMED' | 'DISABLED' | 'REVOKED';

  @IsOptional()
  @IsUUID()
  guideId?: string;
}
