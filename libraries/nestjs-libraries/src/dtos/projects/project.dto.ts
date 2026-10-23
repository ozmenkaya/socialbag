import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
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

export class ProjectFilesQueryDto {
  @IsOptional()
  @IsIn(['image', 'video', 'document', 'other'])
  kind?: 'image' | 'video' | 'document' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;
}

export class ProjectFileImportDto {
  // media folder (mediaFoldersListTool) the file is put in
  @IsOptional()
  @IsString()
  folderId?: string;
}
