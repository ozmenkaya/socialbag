import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateMediaFolderDto {
  @IsDefined()
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateMediaFolderDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  // null moves the folder to the top level
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class MediaFolderIntegrationsDto {
  @IsDefined()
  @IsArray()
  @IsString({ each: true })
  integrations: string[];
}

export class MoveMediaDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  media: string[];

  // null moves the media outside of any folder
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
