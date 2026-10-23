import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

// The whole project at once: the lists replace what was linked before
export class ProjectDto {
  @IsDefined()
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  integrations: string[];

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  folders: string[];

  // links (or ids) of Google Drive folders shared with the archive
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  driveFolders: string[];
}
