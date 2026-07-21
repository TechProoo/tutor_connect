import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStudentSurveyDto {
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
  struggled?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courses?: string[];

  @IsOptional()
  @IsString()
  runTo?: string;

  @IsOptional()
  @IsString()
  wished?: string;

  @IsOptional()
  @IsString()
  wouldUse?: string;

  @IsOptional()
  @IsString()
  rate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trust?: string[];

  @IsOptional()
  @IsString()
  timing?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  suggestions?: string;
}
