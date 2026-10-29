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
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// what the template designs of the project are made of
export class ProjectBrandDto {
  // media of the library, a png with a transparent background fits best
  @IsOptional()
  @IsString()
  logoId?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primary?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accent?: string;

  @IsOptional()
  @IsIn(['modern', 'elegant'])
  font?: 'modern' | 'elegant';

  // phone, website... shown at the bottom of the designs
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string;

  // the customer's WhatsApp number the designs are sent to for approval
  @IsOptional()
  @IsString()
  @MaxLength(30)
  approvalPhone?: string;
}

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

  // left as it was when not sent
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectBrandDto)
  brand?: ProjectBrandDto;
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
