import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class McpAccessKeyDto {
  @IsString()
  @IsDefined()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsBoolean()
  @IsDefined()
  readOnly: boolean;

  // empty means every channel of the organization
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  integrationIds: string[];
}
