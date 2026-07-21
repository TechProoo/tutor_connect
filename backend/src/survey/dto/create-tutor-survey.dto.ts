import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTutorSurveyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  school: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  faculty: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  department: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  helped?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  canTeach?: string;

  @IsOptional()
  @IsString()
  interested?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  why?: string[];

  @IsOptional()
  @IsString()
  earn?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  stopYou?: string;

  @IsOptional()
  @IsString()
  join?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  suggestions?: string;
}
